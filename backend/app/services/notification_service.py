import logging
import smtplib
from email.message import EmailMessage
from smtplib import SMTPAuthenticationError

from app.core.config import settings


logger = logging.getLogger(__name__)


class NotificationService:
    def send_resolution_email(self, flag_detail) -> None:
        if not settings.notification_email_enabled:
            return

        action_taken = flag_detail.flag.resolution_status
        if action_taken == "voided":
            recipients = self._recipients(settings.agent_retake_email_recipients)
            subject = "學習測驗重修通知"
            body = self._build_voided_body(flag_detail)
        elif action_taken == "escalated_to_hr":
            recipients = self._recipients(settings.hr_email_recipients)
            subject = f"高作弊嫌疑調查通知：{flag_detail.flag.agent_name}"
            body = self._build_hr_escalation_body(flag_detail)
        else:
            return

        self._send_email(recipients=recipients, subject=subject, body=body)

    @staticmethod
    def _recipients(preferred_recipients: str) -> list[str]:
        raw_recipients = preferred_recipients or settings.notification_email_recipients
        return [
            recipient.strip()
            for recipient in raw_recipients.split(",")
            if recipient.strip()
        ]

    @staticmethod
    def _build_voided_body(flag_detail) -> str:
        return "\n".join(
            [
                f"{flag_detail.flag.agent_name} 您好：",
                "",
                "主管審核後，這次學習測驗紀錄已被判定為「作廢重修」。",
                "系統偵測到本次學習或測驗流程可能存在作弊風險，請重新進行學習及測試。",
                "",
                f"業務員：{flag_detail.flag.agent_name}（{flag_detail.flag.agent_id}）",
                f"課程：{flag_detail.flag.course_name}",
                f"異常規則：{flag_detail.rule.rule_name}（{flag_detail.rule.rule_code}）",
                f"風險原因：{flag_detail.flag.risk_reason}",
                "",
                "請依主管指示完成重修，並確保學習與測驗過程符合合規要求。",
            ]
        )

    @staticmethod
    def _build_hr_escalation_body(flag_detail) -> str:
        return "\n".join(
            [
                "HR 您好：",
                "",
                f"業務員 {flag_detail.flag.agent_name}（{flag_detail.flag.agent_id}）有高度作弊嫌疑，請詳細調查。",
                "",
                f"分行：{flag_detail.flag.branch_name}",
                f"課程：{flag_detail.flag.course_name}",
                f"異常規則：{flag_detail.rule.rule_name}（{flag_detail.rule.rule_code}）",
                f"風險等級：{flag_detail.flag.severity_level}",
                f"風險原因：{flag_detail.flag.risk_reason}",
                f"Session ID：{flag_detail.flag.session_id}",
                "",
                "此通知由 Anti-Gaming 合規風險監控系統自動發送。",
            ]
        )

    @staticmethod
    def _send_email(recipients: list[str], subject: str, body: str) -> None:
        if not recipients or not settings.smtp_host:
            logger.info("Email notification skipped because SMTP recipients or host are not configured.")
            return

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = settings.smtp_from_email
        message["To"] = ", ".join(recipients)
        message.set_content(body)

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, NotificationService._smtp_password())
                smtp.send_message(message)
        except SMTPAuthenticationError:
            logger.exception(
                "Failed to send resolution notification email because SMTP authentication failed. "
                "For Gmail, use a Google app password instead of the regular account password."
            )
        except Exception:
            logger.exception("Failed to send resolution notification email.")

    @staticmethod
    def _smtp_password() -> str:
        return "".join(settings.smtp_password.split())
