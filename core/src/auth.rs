use crate::store::{Account, Store};
use anyhow::{bail, Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
use uuid::Uuid;
const TOKEN: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const SCOPE: &str = "XboxLive.signin offline_access";
#[derive(Serialize, Deserialize)]
struct Credential {
    client_id: String,
    refresh_token: String,
}
pub struct Session {
    pub account: Account,
    pub access_token: String,
    pub client_id: String,
    pub xuid: String,
}
/// Local identity for development launches; never persisted as a Microsoft account.
pub(crate) fn debug_session() -> Session {
    Session {
        account: Account {
            id: "2b4f29ac7a2f366dacf8457b8011111e".into(),
            name: "ChestDebug".into(),
        },
        access_token: "chest-offline-debug".into(),
        client_id: String::new(),
        xuid: String::new(),
    }
}
fn entry(store: &Store, id: &str) -> Result<keyring::Entry> {
    Ok(keyring::Entry::new(store.credential_service(), id)?)
}
async fn response(request: reqwest::RequestBuilder, label: &str) -> Result<Value> {
    let response = request
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .context("Authentication service could not be reached")?;
    let status = response.status();
    // Error pages are sometimes HTML; preserve the service/status without exposing bodies.
    let value = response.json::<Value>().await;
    if status.is_success() && value.is_err() { bail!("Invalid authentication response"); }
    let value=value.unwrap_or(Value::Null);
    if !status.is_success() {
        let detail = match value.get("XErr").and_then(Value::as_u64) {
            Some(2148916233) => "Create an Xbox profile first.",
            Some(2148916238) => "This account needs family permissions.",
            _ => "Check your account and Chest's Microsoft application registration.",
        };
        bail!("{label} failed ({status}). {detail}");
    }
    Ok(value)
}
fn text(v: &Value, key: &str) -> Result<String> {
    Ok(v.get(key)
        .and_then(Value::as_str)
        .with_context(|| format!("Authentication response missing {key}"))?
        .into())
}
async fn minecraft(client: &reqwest::Client, msa: &str, client_id: &str) -> Result<Session> {
    let xbox=response(client.post("https://user.auth.xboxlive.com/user/authenticate").header("x-xbl-contract-version","1")
        .json(&json!({"Properties":{"AuthMethod":"RPS","SiteName":"user.auth.xboxlive.com","RpsTicket":format!("d={msa}")},"RelyingParty":"http://auth.xboxlive.com","TokenType":"JWT"})),"Xbox sign-in").await?;
    let xsts=response(client.post("https://xsts.auth.xboxlive.com/xsts/authorize").header("x-xbl-contract-version","1")
        .json(&json!({"Properties":{"SandboxId":"RETAIL","UserTokens":[text(&xbox,"Token")?]},"RelyingParty":"rp://api.minecraftservices.com/","TokenType":"JWT"})),"Xbox authorization").await?;
    let hash = xsts
        .pointer("/DisplayClaims/xui/0/uhs")
        .and_then(Value::as_str)
        .context("Xbox user hash missing")?;
    let token = response(
        client
            .post("https://api.minecraftservices.com/authentication/login_with_xbox")
            .json(&json!({"identityToken":format!("XBL3.0 x={hash};{}",text(&xsts,"Token")?)})),
        "Minecraft sign-in",
    )
    .await?;
    let access_token = text(&token, "access_token")?;
    let entitlements = response(
        client
            .get("https://api.minecraftservices.com/entitlements/mcstore")
            .bearer_auth(&access_token),
        "Minecraft ownership check",
    )
    .await?;
    if entitlements
        .get("items")
        .and_then(Value::as_array)
        .is_none_or(|i| i.is_empty())
    {
        bail!("This account does not own Minecraft Java Edition");
    }
    let profile = response(
        client
            .get("https://api.minecraftservices.com/minecraft/profile")
            .bearer_auth(&access_token),
        "Minecraft profile",
    )
    .await?;
    Ok(Session {
        account: Account {
            id: text(&profile, "id")?,
            name: text(&profile, "name")?,
        },
        access_token,
        client_id: client_id.into(),
        xuid: xsts
            .pointer("/DisplayClaims/xui/0/xid")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .into(),
    })
}
// Ignore unrelated or malformed loopback traffic without aborting a valid login.
fn callback_code(request: &[u8], state: &str) -> Option<Result<String>> {
    let request=std::str::from_utf8(request).ok()?;
    let mut first=request.lines().next()?.split_whitespace();
    if first.next()? != "GET" {return None;}
    let target=first.next()?;
    if !target.starts_with("/callback?") || !matches!(first.next(),Some("HTTP/1.0"|"HTTP/1.1")) || first.next().is_some(){return None;}
    let callback=url::Url::parse(&format!("http://localhost{target}")).ok()?;
    if callback.path()!="/callback" {return None;}
    let params=callback.query_pairs().collect::<Vec<_>>();
    let states=params.iter().filter(|(key,_)|key=="state").collect::<Vec<_>>();
    if states.len()!=1 || states[0].1!=state{return None;}
    if params.iter().any(|(key,_)|key=="error"){return Some(Err(anyhow::anyhow!("Microsoft sign-in was declined")));}
    let codes=params.iter().filter(|(key,_)|key=="code").collect::<Vec<_>>();
    if codes.len()!=1 || codes[0].1.is_empty(){return None;}
    Some(Ok(codes[0].1.to_string()))
}
pub async fn sign_in(
    store: &Store,
    client: &reqwest::Client,
    cancel: Arc<AtomicBool>,
) -> Result<Account> {
    let client_id = store.config().client_id;
    Uuid::parse_str(&client_id)
        .context("Set Chest's Microsoft application ID in Settings first")?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let redirect = format!(
        "http://localhost:{}/callback",
        listener.local_addr()?.port()
    );
    let verifier = URL_SAFE_NO_PAD.encode(
        [
            Uuid::new_v4().as_bytes().as_slice(),
            Uuid::new_v4().as_bytes().as_slice(),
        ]
        .concat(),
    );
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = Uuid::new_v4().to_string();
    let mut url =
        url::Url::parse("https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize")?;
    url.query_pairs_mut().extend_pairs([
        ("client_id", client_id.as_str()),
        ("response_type", "code"),
        ("redirect_uri", redirect.as_str()),
        ("scope", SCOPE),
        ("state", state.as_str()),
        ("code_challenge", challenge.as_str()),
        ("code_challenge_method", "S256"),
        ("prompt", "select_account"),
    ]);
    open::that(url.as_str()).context("Could not open your browser")?;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(300);
    let code = loop {
        if cancel.load(Ordering::Relaxed) {
            bail!("Sign-in cancelled");
        }
        if tokio::time::Instant::now() > deadline {
            bail!("Sign-in timed out. Try again.");
        }
        let connection = tokio::select! { c=listener.accept()=>Some(c?),_=tokio::time::sleep(Duration::from_millis(150))=>None};
        let Some((mut stream, _)) = connection else {
            continue;
        };
        let mut bytes = vec![0u8; 8192];
        let size = match tokio::time::timeout(Duration::from_secs(3), stream.read(&mut bytes)).await {
            Ok(Ok(size))=>size,
            _=>continue,
        };
        let Some(code)=callback_code(&bytes[..size],&state) else {
            let _=stream.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
            continue;
        };
        let message =
            "<!doctype html><title>Chest</title><p>You can return to Chest and close this tab.</p>";
        let reply=format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{message}",message.len());
        let _ = stream.write_all(reply.as_bytes()).await;
        break code?;
    };
    if cancel.load(Ordering::Relaxed) {
        bail!("Sign-in cancelled");
    }
    let token = response(
        client.post(TOKEN).form(&[
            ("client_id", client_id.as_str()),
            ("code", code.as_str()),
            ("redirect_uri", redirect.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", verifier.as_str()),
        ]),
        "Microsoft sign-in",
    )
    .await?;
    let session = minecraft(client, &text(&token, "access_token")?, &client_id).await?;
    if cancel.load(Ordering::Relaxed) {
        bail!("Sign-in cancelled");
    }
    entry(store, &session.account.id)?
        .set_password(&serde_json::to_string(&Credential {
            client_id,
            refresh_token: text(&token, "refresh_token")?,
        })?)
        .context("Could not save credentials in your OS credential store")?;
    store.change(|c| {
        c.accounts.retain(|a| a.id != session.account.id);
        c.accounts.push(session.account.clone());
        c.active_account = Some(session.account.id.clone());
        Ok(())
    })?;
    Ok(session.account)
}
pub async fn refresh(store: &Store, client: &reqwest::Client) -> Result<Session> {
    refresh_for(store, client, None).await
}
pub async fn refresh_for(store: &Store, client: &reqwest::Client, selected: Option<&str>) -> Result<Session> {
    let config=store.config();
    let id=selected.map(str::to_owned).or(config.active_account).context("Sign in with Microsoft before launching")?;
    if !config.accounts.iter().any(|a| a.id==id) { bail!("Selected account is no longer signed in"); }
    let credential: Credential = serde_json::from_str(
        &entry(store, &id)?
            .get_password()
            .context("Could not read account credentials; sign in again")?,
    )?;
    let token = response(
        client.post(TOKEN).form(&[
            ("client_id", credential.client_id.as_str()),
            ("refresh_token", credential.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
            ("scope", SCOPE),
        ]),
        "Account refresh",
    )
    .await?;
    let session = minecraft(
        client,
        &text(&token, "access_token")?,
        &credential.client_id,
    )
    .await?;
    if session.account.id != id {
        bail!("Account changed during refresh; sign in again");
    }
    if let Some(new) = token.get("refresh_token").and_then(Value::as_str) {
        entry(store, &id)?.set_password(&serde_json::to_string(&Credential {
            client_id: credential.client_id.clone(),
            refresh_token: new.into(),
        })?)?;
    }
    Ok(session)
}
pub fn sign_out(store: &Store, id: &str) -> Result<()> {
    if !store.config().accounts.iter().any(|a| a.id == id) {
        bail!("Account not found");
    }
    match entry(store, id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => (),
        Err(e) => return Err(e.into()),
    }
    store.change(|c| {
        c.accounts.retain(|a| a.id != id);
        if c.active_account.as_deref() == Some(id) {
            c.active_account = c.accounts.first().map(|a| a.id.clone());
        }
        Ok(())
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn callback_requires_matching_unique_state_and_code(){
        let valid=b"GET /callback?state=expected&code=a%2Bb HTTP/1.1\r\nHost: localhost\r\n\r\n";
        assert_eq!(callback_code(valid,"expected").unwrap().unwrap(),"a+b");
        for target in ["/favicon.ico","/callback?state=wrong&code=x","/callback?state=expected&state=expected&code=x","/callback?state=expected&code=x&code=y","/callback?state=expected&code=","http://invalid/callback?state=expected&code=x"]{
            assert!(callback_code(format!("GET {target} HTTP/1.1\r\n\r\n").as_bytes(),"expected").is_none());
        }
        assert!(callback_code(b"POST /callback?state=expected&code=x HTTP/1.1","expected").is_none());
        assert!(callback_code(&[255,0],"expected").is_none());
    }
    #[test]
    fn callback_decline_is_sanitized(){
        let error=callback_code(b"GET /callback?state=expected&error=access_denied&error_description=secret HTTP/1.1","expected").unwrap().unwrap_err();
        assert_eq!(error.to_string(),"Microsoft sign-in was declined");
    }
}
