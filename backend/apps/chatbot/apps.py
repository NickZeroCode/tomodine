from django.apps import AppConfig


class ChatbotConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.chatbot"
    verbose_name = "AI Concierge"

    def ready(self):
        # Register signals for auto embedding sync on dish save.
        import apps.chatbot.signals  # noqa: F401
