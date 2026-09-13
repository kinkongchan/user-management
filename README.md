# User Management

Cognito authentication, a FastAPI API, and a React client. Provision AWS with Terraform, deploy FastAPI with CodeDeploy, and host the React app on S3 behind CloudFront (HTTPS `*.cloudfront.net`, no custom domain or ACM cert).

```mermaid
flowchart LR
  subgraph laptop [Your laptop]
    DeployBackend["backend/deploy.sh"]
    DeployFrontend["frontend/deploy.sh"]
  end

  subgraph aws [AWS]
    CF[CloudFront]
    S3Web[S3 frontend]
    S3Media[S3 media]
    Cognito[Cognito user pool]
    APIGW[API Gateway]
    CodeDeploy[CodeDeploy]
    S3[S3 revisions]
    subgraph vpc [VPC]
      ALB[Application Load Balancer]
      EC2[EC2 FastAPI]
      RDS[RDS Postgres]
    end
  end

  Browser[Browser] -->|HTTPS cloudfront.net| CF
  CF --> S3Web
  Browser -->|"signup / login"| Cognito
  Browser -->|Bearer ID token| APIGW
  Browser -->|presigned PUT parts| S3Media
  Browser -->|presigned GET play| S3Media
  APIGW -->|"JWT authorizer, X-Cognito-Sub"| ALB
  ALB --> EC2
  EC2 --> RDS
  EC2 -->|multipart start/complete| S3Media
  DeployFrontend -->|upload static files| S3Web
  DeployBackend -->|upload revision| S3
  S3 --> CodeDeploy
  CodeDeploy -->|install and start uvicorn| EC2
```

## Signup workflow

Sign up and confirm talk only to Cognito. API Gateway and FastAPI run after the user logs in.

```mermaid
sequenceDiagram
  participant User
  participant React
  participant Cognito
  participant Mail as User_email
  participant APIGW as API_Gateway
  participant ALB
  participant FastAPI
  participant RDS

  User->>React: email and password
  React->>Cognito: SignUp
  Cognito->>Mail: verification code
  Cognito-->>React: user created unconfirmed
  React-->>User: open Confirm page

  User->>React: verification code
  React->>Cognito: ConfirmSignUp
  Cognito-->>React: confirmed
  React-->>User: open Login page

  User->>React: email and password
  React->>Cognito: AuthenticateUser
  Cognito-->>React: ID token
  React->>APIGW: GET /hello with Bearer token
  APIGW->>APIGW: verify JWT
  APIGW->>ALB: HTTP plus X-Cognito-Sub
  ALB->>FastAPI: GET /hello
  FastAPI->>RDS: insert user_id and login_time
  FastAPI-->>React: hello user_id
```

## Open uploaded file

The Media table filename is a link. Multipart uploads become **one** S3 object after complete, so the link plays or shows that single file. The click goes to S3, not back through API Gateway.

```mermaid
sequenceDiagram
  participant User
  participant React
  participant APIGW as API_Gateway
  participant FastAPI
  participant RDS
  participant S3 as S3_media

  User->>React: open Media
  React->>APIGW: GET /media with Bearer token
  APIGW->>APIGW: verify JWT
  APIGW->>FastAPI: GET /media plus X-Cognito-Sub
  FastAPI->>RDS: completed rows for this user_id
  FastAPI->>FastAPI: presigned GET for each s3_key
  FastAPI-->>React: timestamp, file_name, file_size, url
  React-->>User: table with filename links

  User->>React: click Uploaded file
  React->>S3: GET presigned url
  S3-->>User: one assembled object inline
```

## Prerequisites

- AWS CLI (`aws configure` — you do this yourself)
- Terraform >= 1.5
- Node.js 20+ (to build or run the React UI)
- Python 3.9 for FastAPI (Amazon Linux 2023 system `python3` on EC2; `backend/requirements.txt` does not pin the interpreter). Keep backend code 3.9-compatible (`Union` / `Optional`, no `str | int`, no backslashes inside f-strings, no `match`/`case`).

## 1. Provision infrastructure

`terraform apply` creates Cognito, API Gateway, the ALB, one EC2 instance, RDS, a CodeDeploy application, a revision bucket, a public S3 website bucket, a private media bucket, and a CloudFront distribution for the React app. It does **not** start FastAPI or upload frontend files. CloudFront uses the default `*.cloudfront.net` certificate (no ACM). The first CloudFront deploy can take several minutes. App env vars such as `MEDIA_BUCKET` and `DATABASE_URL` are written by `backend/codedeploy/after_install.sh` on each `./backend/deploy.sh`, not by EC2 user data.

From `user-management/`:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # edit aws_region if needed
terraform init
terraform apply
terraform output
```

| Output | Use |
|---|---|
| `api_gateway_url` | Frontend `VITE_API_URL` |
| `cognito_user_pool_id` | Frontend `VITE_COGNITO_USER_POOL_ID` |
| `cognito_app_client_id` | Frontend `VITE_COGNITO_CLIENT_ID` |
| `codedeploy_app` | Used by `backend/deploy.sh` |
| `codedeploy_bucket` | CodeDeploy revision store |
| `frontend_bucket` | Used by `frontend/deploy.sh` |
| `frontend_url` | Public S3 website URL (HTTP) |
| `frontend_cloudfront_url` | HTTPS CloudFront URL (open this in a browser) |
| `frontend_cloudfront_distribution_id` | Used by `frontend/deploy.sh` to invalidate cache |
| `media_bucket` | Private S3 bucket for image/video multipart uploads |
| `aws_region` | Same region you applied in |

Wait a few minutes after apply so the instance installs the CodeDeploy agent.

## 2. Deploy FastAPI with CodeDeploy

From `user-management/`:

```bash
./backend/deploy.sh
```

That zips `backend/` (including `appspec.yml`), uploads a revision, and starts a CodeDeploy in-place deployment. The agent on EC2 copies the files, creates a venv with system Python 3.9, installs dependencies, and starts uvicorn.

Re-run the same script after API code changes. Do not run `terraform apply` just to ship app code.

The CodeDeploy S3 bucket is only the revision store. You do not SSH or copy files onto the VM yourself.

## 3. Run the UI on your laptop (optional)

```bash
cd frontend
cp .env.example .env
```

Set in `frontend/.env`:

```
VITE_COGNITO_USER_POOL_ID=<cognito_user_pool_id>
VITE_COGNITO_CLIENT_ID=<cognito_app_client_id>
VITE_API_URL=<api_gateway_url>
```

```bash
npm install
npm run dev
```

Open http://localhost:5173 and:

1. Sign up with email + password
2. Confirm the code Cognito emails you
3. Log in — you land on Media
4. Upload an image or video; the table should show timestamp, file name, and size
5. Hello should show `hello <cognito user id>` and write a login row in RDS
6. Logins should list every stored `user_id` + `login_time`
7. From Log in, use Forgot password, enter the emailed code and a new password, then log in with the new password

## 4. Deploy the UI to S3

From `user-management/`:

```bash
./frontend/deploy.sh
```

The script reads Terraform outputs, builds the React app with those `VITE_*` values, syncs `frontend/dist/` to the public website bucket, and invalidates the CloudFront cache. Vite inlines the env vars at build time, so you must rebuild after API Gateway or Cognito values change.

Open the printed `frontend_cloudfront_url` (HTTPS, for example `https://d111111abcdef8.cloudfront.net`) and run the same checks as local:

1. Sign up with email + password
2. Confirm the code Cognito emails you
3. Log in — you land on Media
4. Upload an image or video; the table should show timestamp, file name, and size
5. Hello should show `hello <cognito user id>` and write a login row in RDS
6. Logins should list every stored `user_id` + `login_time`
7. From Log in, use Forgot password, enter the emailed code and a new password, then log in with the new password

Refreshing `/login`, `/hello`, `/media`, or `/reset-password` is served as `index.html` (CloudFront custom error response, and the S3 website `error_document`). Re-run `./frontend/deploy.sh` after UI code changes.

After adding the media bucket, run `terraform apply` (creates the bucket, IAM, and POST route; it does not replace EC2), then `./backend/deploy.sh`, then `./frontend/deploy.sh`.

The S3 website URL (`frontend_url`) still works over HTTP if you need it. There is no custom domain or ACM certificate yet.

## Endpoints

`/health` is ALB only. The rest go through API Gateway.

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/health` | No (ALB only) | Load balancer health check |
| GET | `/hello` | Yes | Insert login row, return `hello <user_id>` |
| GET | `/logins` | Yes | All login rows, newest first |
| POST | `/media/uploads` | Yes | Start S3 multipart upload, return 500 MB part presigned URLs |
| POST | `/media/uploads/{id}/complete` | Yes | Complete multipart upload |
| GET | `/media` | Yes | Current user's completed uploads (timestamp, file name, size, play URL) |
| DELETE | `/media/{id}` | Yes | Delete the S3 object and the row |

API Gateway verifies the Cognito JWT and forwards the user id as `X-Cognito-Sub`.

## Tear down

```bash
cd terraform
terraform destroy
```

NAT Gateway, ALB, RDS, the EC2 instance, and CloudFront incur charges while the stack is up.
