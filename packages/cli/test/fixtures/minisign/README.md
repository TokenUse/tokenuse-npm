Throwaway minisign vectors for `verifyMinisignSignature` tests.

Generated with real `minisign 0.12` (`-G -W`, i.e. an unencrypted throwaway key)
purely so the pure-Node verifier is validated against genuine minisign output
rather than against our own encoder. The private half was discarded and never
existed outside a scratch directory.

**This is not, and must never be, the TokenUse release-signing key.** The real
public key belongs in `MINISIGN_PUBKEY` in `src/install.js` and
`tokenuse/install.sh`.
