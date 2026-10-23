# Judge access plan — owner actions pending

> **Cập nhật 23/10/2026:** App Vercel/Render/Atlas **public read-only**, GitHub OAuth operator đọc Judge Run đã được kiểm chứng; rehearsal production đã thành công và cycle 2 BASELINE revision 5, hiện khóa các action. Các đoạn “loopback only”, “remote authentication incomplete” bên dưới là lịch sử 19/10. Vấn đề **repo GitHub cá nhân private không có role collaborator chỉ đọc** vẫn cần owner cùng BTC thống nhất; không tự đổi visibility hay invite. Xem [hồ sơ nộp](FINAL_RELEASE_AND_SUBMISSION.md).

Verified 19 October 2026: `thangak18/OneNode-ChargeGuard` is private and owned by a **User**, not an organization. No access invitation, repository transfer or visibility change was made.

The [competition terms §7.4](https://mini-hackathon-sep-2026.mugvn.com/terms) require organizer-specified judge accounts to have read access before 31 October 2026, 23:59 ICT, maintained through 22 November 2026. Submitted materials may be publicly showcased (§9); do not treat submission as confidential.

[GitHub personal repository permissions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository) give private-repository collaborators read **and write** access. There is no personal-repository Read-only collaborator role. Do not follow instructions to select a nonexistent Read role, or silently grant broader access.

1. Obtain exact official GitHub usernames and accessible-demo requirements from the organizer. Do not guess accounts or invite anyone automatically.
2. Owner and organizer agree how to meet the access requirement. Options requiring explicit owner approval include accepting personal-repo collaborator write access, or evaluating an organization repository with a genuine Read role. A transfer/copy/archive is not automatically approved or equivalent under the competition rules.
3. Only after that decision, grant the agreed access through the applicable GitHub Settings interface. Confirm invitations are accepted and the approved judge can open the final commit/README. Keep secrets/raw ACN data excluded regardless of repository privacy.
4. Confirm how judges will access the runnable MVP. Current services are loopback-only and remote production authentication is incomplete; do not expose them through a tunnel. Ask whether an organizer-approved local demonstration/recording is acceptable.
5. Record final pre-deadline commit SHA, maintain access through 22 November, and freeze repository changes after the deadline as required. Verify exact Datadog trial expiry and ask the organizer about any needed extension; do not purchase or enable paid services automatically.

No public deployment, invitation, submission or external inquiry is performed by this plan.
