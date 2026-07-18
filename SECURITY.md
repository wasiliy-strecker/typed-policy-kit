# Security policy

## Supported versions

Security fixes target the latest released minor version while the project remains below version 1.0.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for this repository and include:

- Affected package and version
- Minimal reproduction
- Expected and observed authorization decision
- Potential impact

Reports are acknowledged as soon as practical. A fix, advisory, and coordinated disclosure timeline will be agreed after validation.

## Security boundary

`typed-policy-react` is a usability adapter and cannot secure an API. Enforcement belongs in trusted server code such as `typed-policy-express`. Applications remain responsible for authentication, trusted subject construction, resource loading, tenant context, and protecting policy source code.
