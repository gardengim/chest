# Chest Microsoft/Minecraft registration

Verified October 12, 2026 against the current authentication implementation and
Microsoft/Mojang documentation. No application has been registered by this guide.

## 1. Register Chest

Open [Microsoft Entra app registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
and sign in with the account that will own the registration. A tenant with app
registration permission is required; see [Microsoft's prerequisites](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).

Create a new application:

| Setting | Value |
| --- | --- |
| Display name | `Chest` |
| Supported users | Personal Microsoft accounts; choose personal-only if offered, otherwise organizational directories **and personal Microsoft accounts** |
| Authentication platform | Mobile and desktop applications |
| Custom redirect URI | `http://localhost/callback` |
| OAuth flow | Authorization code with PKCE (`S256`), using the system browser |
| Authority used by Chest | `https://login.microsoftonline.com/consumers` |
| Requested scopes | `XboxLive.signin offline_access` |
| Client secret | None: Chest is a public desktop client |

Configure the redirect under Authentication if registration does not offer the
mobile/desktop platform directly. Chest binds an ephemeral loopback port and sends
`http://localhost:<port>/callback`. Microsoft's localhost matching ignores that
port, while the `/callback` path must match. Do not register the redirect as Web
or SPA, and do not enable implicit grants for this authorization-code flow.
Device-code-specific configuration is not needed: Chest does not use device codes.

Copy the **Application (client) ID** and **Directory (tenant) ID** from Overview.
These identifiers are not client secrets. Keep ownership/contact information
current; Mojang's review form cross-checks contact information against Azure.

## 2. Request Minecraft Java API access

Mojang requires approval of new AppIDs separately from Microsoft registration.
The [official policy](https://help.minecraft.net/hc/en-us/articles/16254801392141)
links to the [AppID Review form](https://aka.ms/mce-reviewappid).

Prepare these form answers:

| Field | Answer |
| --- | --- |
| EULA and Usage Guidelines acknowledgement | The owner must read and acknowledge these personally |
| Contact | Owner's valid email, consistent with Azure contact information |
| Request type | New AppID for Approval |
| Application name | Chest |
| Application ID | Application (client) ID from Entra |
| Tenant ID | Directory (tenant) ID from Entra |
| Associated website | `https://github.com/gardengim/chest` |

Suggested justification, for owner review:

> Chest is an open-source desktop launcher for Minecraft Java Edition on Windows,
> macOS and Linux. It manages separate Vanilla, Fabric and Quilt instances and
> their mods, resource packs and shaders. We request Java Edition game service
> API access to authenticate users, verify game ownership and obtain their player
> profiles before launching the game. Sign-in uses the system browser with OAuth
> authorization code and PKCE; Chest does not collect Microsoft passwords.
> Refresh tokens are stored in the operating system credential store. Production
> builds require authenticated Java Edition ownership. Source code is available
> at https://github.com/gardengim/chest under the MIT license.

The form says reviews occur weekly; that is not an approval deadline. Do not
submit duplicates. Its naming rules exclude names containing Mojang, Minecraft,
Microsoft, Live, Xbox, Discord or Hypixel; `Chest` avoids those terms. No review
request or EULA acknowledgement has been submitted automatically.

## 3. Configure and validate

Enter the client ID in Chest under Settings → Settings → Microsoft application
setup, then save. `CHEST_CLIENT_ID` supplies an initial value only for fresh
configurations; setting it does not replace an existing saved ID.

After approval, use an isolated profile and an owning account to verify browser
sign-in, Xbox/XSTS exchange, Minecraft ownership/profile retrieval, launch,
refresh after restarting Chest, account switching and sign-out. A Microsoft
registration alone does not prove Minecraft access. Keep tokens, passwords and
credential-store contents out of logs and issue reports.

For public releases, wire the approved **public client ID** into release defaults
so ordinary users need not register their own app. That integration remains
pending until Chest's own registration exists; never substitute another
launcher's client ID.

## Sources

- [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Desktop/loopback redirect configuration](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)
- [Authorization code and PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Minecraft Java API review policy](https://help.minecraft.net/hc/en-us/articles/16254801392141)
- [AppID Review form](https://aka.ms/mce-reviewappid)
