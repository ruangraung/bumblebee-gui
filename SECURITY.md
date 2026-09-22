# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository: open the **Security** tab and choose **Report a vulnerability**. The report stays private between you and the maintainer until a fix is published.

Please do not open a public issue for a vulnerability.

A useful report says:

- what the problem is, and where in the project it lives
- how to reproduce it, including the commit or image you tested
- what an attacker could do with it
- a suggested fix, if you have one

There is no bug bounty and no guaranteed response time. This is a small project maintained in spare time. Reports are read and answered as soon as possible.

## Supported versions

Only the latest commit on `main` is supported. There are no maintained release branches yet.

## Scope

In scope:

- the backend API and the frontend in this repository
- the Docker Compose setup and its default configuration
- the image builds and the bundled exposure catalogues

Out of scope:

- the upstream Bumblebee scanner and its catalogues. Report those to
  [perplexityai/bumblebee](https://github.com/perplexityai/bumblebee/issues).
- a vulnerability in a dependency with no exploitable path through this project

## How this project runs

Bumblebee GUI is an unofficial interface to the Bumblebee scanner, not affiliated with Perplexity. It runs on the host that starts it. The API binds to loopback by default, and a directory is only scanned if it is mounted into the backend container, read-only, by whoever starts the stack. Nothing is sent anywhere except the upstream threat-intel downloads performed during the image build.

## Reporting something that is not a vulnerability

Misleading output is worth reporting as a normal issue: a scan that matches nothing and a scan whose catalogues are stale should not look alike, and a scan that stopped early should say so. If you find a case where the interface states more confidence than the data supports, open an issue.
