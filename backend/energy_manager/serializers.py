from rest_framework import serializers

from .models import Recommendation


class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommendation
        fields = [
            'id', 'created_at', 'decided_at', 'hour', 'price_tier', 'solar_tier', 'battery_tier',
            'action', 'action_label', 'q_value', 'alternatives', 'explanation', 'status',
        ]
        read_only_fields = fields
