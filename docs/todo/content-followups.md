# TODO — follow-up biên tập còn mở

Đợt rà 2026-09-12 đã áp 226/235 đề xuất từ `docs/research/` vào `public/data/`
và chuyển 120 claim kèm nguồn vào `content-reviews.json`; thư mục research đã
gỡ, bản ghi cuối (kèm dấu tick) nằm ở commit ngay trước commit gỡ:
`git log -1 --format=%h --diff-filter=D -- docs/research/index.md`.

Còn lại 9 mục, mỗi mục để mở có lý do:

- **20-observability** — audit toàn bộ SLI/threshold, chi phí provider, retention
  và cấu hình collector: cần config triển khai thật, không có để đối chiếu.
- **case 10 (authn/authz microservices)** — 7 mục sửa *body* bài: body HTML là
  bài lưu trữ (freeze), chỉ *guide* mới sửa được; guide đã sửa.
- **case 13 (Discord)** — audit storage-engine/version và current-system: cần
  nguồn bổ sung mới hơn bài 2023.

Xoá file này khi hết ô trống.

### 20-observability-sre — 1 mục

- [ ] The broader audit of every SLI/threshold, provider cost, retention, and current collector configuration remains a follow-up.

### 10-xac-thuc-va-phan-quyen-trong-microservices — 7 mục

- [ ] Correct EN `ma-hoa-rsa-cho-jwt`: distinguish JWS signing from JWE encryption and explain RSA algorithm choice only with a named profile.
- [ ] Correct EN `oauth-2`: OAuth 2.0 is authorization/delegation; OIDC is the identity layer.
- [ ] Align VI and EN on issuer/audience/algorithm/type/time validation and service-side authorization.
- [ ] Replace universal JWT performance/revocation claims with the comparison table.
- [ ] Keep ACL/RBAC/PBAC examples but state that ABAC is the NIST term for subject/object/action/environment attributes; PBAC is a broader policy-based architecture label.
- [ ] Add key-rotation/introspection/gateway-bypass/BOLA tests and metrics.
- [ ] Preserve the paired IDs and fix the malformed regex/example quote before content integration.

### 13-how-discord-stores-trillions-of-messages — 1 mục

- [ ] The broader storage-engine/version and current-system audit below remains a follow-up; reported Discord numbers stay source-scoped.
