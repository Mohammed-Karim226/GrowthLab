# Synthetic TLS fixture

This self-signed certificate and private key are public test fixtures for a
loopback-only synthetic PostgreSQL server. They protect no real service and
must not be used by an application or trusted by a deployment. Tests use fake
credentials and never load the project's private environment files.

Regenerate with:

```sh
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 36500 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
```
