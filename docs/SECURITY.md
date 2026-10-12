# Local security and recovery review — October 11, 2026

This is a focused source/test review, not an independent security audit. Packaged fault
injection and live credential acceptance remain release gates.

| Boundary | Protection and evidence | Remaining acceptance |
| --- | --- | --- |
| Microsoft callback | Loopback listener, PKCE and random state; only a unique matching state/code on the callback GET is accepted. Unrelated/malformed traffic is ignored. Callback tests cover duplicate/wrong state, wrong path/method, invalid UTF-8 and sanitized decline. | Real registered application, browser cancellation, token expiry/rotation and OS credential store on each platform |
| Auth responses | Thirty-second request limit; non-JSON service failures retain sanitized HTTP status. Refreshed identity is checked before rotating stored credentials. | Service failure and offline behavior in packaged app |
| Downloads/content | Hash checks and provider allowlists; compatibility and dependency checks; failed queues retained for retry. | Interrupted transfers, disk exhaustion, provider credentials and author-disabled downloads |
| Archives | Traversal/symlink/extraction limits, new identity, local storage parent; imported executable override replaced with local Java default. Roundtrip test checks override replacement and preserved worlds. | Packaged cancellation and disk failure during extraction |
| Java | Selected executable checked with a ten-second timeout; timeout kills the check process. | Wrong/missing Java, automatic runtime and process cleanup across OSes |
| Game logs | Bounded 16-KiB input line and 2,000-entry buffer, session token redaction, oversized lines omitted entirely. Fragmented/oversized/unterminated input tested. | Long-running native sessions; mods can print unrelated secrets |
| App replacement | Signed updater artifacts; maintenance guard excludes new instance jobs during replacement/restart, active jobs block replacement. Guard release on failure tested. | Real A → B update, bad signature, interrupted replacement and rollback on all targets |
| Settings | Corrupt config preserved; changes written through temporary file; mutation conflicts rejected. | Power loss and filesystem failures on all platforms |

Downloaded Minecraft/mod code and a user-selected Java executable run with the user's
permissions. They are trusted executable content, not sandboxed plugins. A checksum
proves the downloaded bytes match provider metadata, not that a mod is safe. Keep backups
and use sources/authors you trust. App updater private keys remain outside the repository.

A packaged test profile now uses its own OS credential service and WebView storage,
rejects normal-data overlap and symlink aliases, and blocks app replacement. It is not a
sandbox for user-selected external folders or executables. Fault-injection tests establish
that interrupted/bad-checksum/HTTP-503 downloads preserve the previous destination, a
verified retry succeeds, blocked directory creation does not publish a file, and missing,
unexecutable or wrong-version Java is rejected. Actual disk exhaustion/power loss remains
untested.

See [recovery guidance](RECOVERY.md) and [packaged acceptance](ACCEPTANCE.md).
