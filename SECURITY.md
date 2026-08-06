# Security Policy

## Supported Versions

Security support covers the latest published TokenUse npm package release.
Please upgrade to the latest release before reporting issues that may already be fixed.

## Verifying A Release

Every TokenUse release from v0.2.0 onward is published with a SHA-256 manifest and an
Ed25519 signature over it. Both installers verify this automatically and **refuse to
install** if verification fails — there is no fall-through.

The trust chain has three independent links:

1. **Checksum** — the downloaded archive must match `checksums.txt` from the release.
2. **Second trust domain** — that manifest is cross-checked byte-for-byte against a
   copy published from a different repository and origin
   (`raw.githubusercontent.com/tokenuse/tokenuse-releases`), so whoever can swap a
   release asset cannot also forge the anchor that verifies it.
3. **Signature** — `SHA256SUMS.minisig` is verified against the public key below.

### Public signing key

```
RWQ6aEjzuLMUY/cSojVBnwBCOHEuSAHs0+ZnIlOYqlVXtMockUbkDXeV
```

This same key is pinned in `install.sh` and in the npm installer, so you can confirm
the value here matches what the installer you ran actually used.

### Verifying by hand

```sh
VERSION=0.4.7
BASE="https://github.com/tokenuse/tokenuse/releases/download/v$VERSION"

curl -fsSLO "$BASE/checksums.txt"
curl -fsSLO "$BASE/SHA256SUMS.minisig"
curl -fsSLO "$BASE/tokenuse_${VERSION}_darwin_arm64.tar.gz"

# 1. signature over the manifest
minisign -Vm checksums.txt -x SHA256SUMS.minisig \
  -P 'RWQ6aEjzuLMUY/cSojVBnwBCOHEuSAHs0+ZnIlOYqlVXtMockUbkDXeV'

# 2. archive matches the manifest
shasum -a 256 -c checksums.txt --ignore-missing
```

Both must pass. If the signature check fails, do not install — please report it to
security@tokenuse.ai.

### Key rotation

If this key ever changes, the published signatures and the pinned key are rotated
together (verification is fail-closed, so they cannot be swapped independently). A
rotation will be announced through the release notes.

## Reporting A Vulnerability

Do not open a public issue for a vulnerability.

Email private reports to security@tokenuse.ai. Include a clear description, affected
version or install channel, reproduction steps, impact, and any relevant logs with
tokens, secrets, prompts, transcripts, and private paths removed.

Canonical disclosure policy: https://www.tokenuse.ai/security/disclosure

We aim to acknowledge reports within 2 business days and will coordinate next steps
privately through the security contact.

If GitHub private vulnerability reporting is enabled for this repository, you may
also use that flow. Email remains the canonical contact.
