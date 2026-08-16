from django.db import models


class Recommendation(models.Model):
    """A single "here's what the AI manager suggests" record — the
    human-in-the-loop trail the dashboard's AI Manager page reads/writes.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REJECTED = 'rejected', 'Rejected'

    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    hour = models.IntegerField()
    price_tier = models.IntegerField()
    solar_tier = models.IntegerField()
    battery_tier = models.IntegerField()

    action = models.CharField(max_length=32)
    action_label = models.CharField(max_length=128)
    q_value = models.FloatField()
    alternatives = models.JSONField(default=list)
    explanation = models.TextField(blank=True, default='')

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} @ hour {self.hour} ({self.status})'
