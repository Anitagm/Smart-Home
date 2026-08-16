from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .ml.infer import AgentNotReady, recommend
from .models import Recommendation
from .serializers import RecommendationSerializer


@api_view(['GET'])
def recommend_view(request):
    """
    GET /api/energy-manager/recommend/?hour=18&battery_percent=40

    Computes a fresh recommendation from the trained Q-table *and* persists
    it as a pending Recommendation row so it shows up in the accept/reject
    history below.
    """
    try:
        result = recommend(
            hour=request.GET.get('hour'),
            battery_percent=float(request.GET['battery_percent']) if 'battery_percent' in request.GET else None,
        )
    except AgentNotReady as exc:
        return Response({'error': str(exc)}, status=503)

    rec = Recommendation.objects.create(
        hour=result['state']['hour'],
        price_tier=result['state']['price_tier'],
        solar_tier=result['state']['solar_tier'],
        battery_tier=result['state']['battery_tier'],
        action=result['recommended_action'],
        action_label=result['recommended_action_label'],
        q_value=result['q_value'],
        alternatives=result['alternatives'],
        explanation=result['explanation'],
    )
    payload = dict(result)
    payload['recommendation_id'] = rec.id
    return Response(payload)


@api_view(['GET'])
def history_view(request):
    """GET /api/energy-manager/history/ — recent recommendations, newest first."""
    qs = Recommendation.objects.all()[:50]
    return Response(RecommendationSerializer(qs, many=True).data)


@api_view(['POST'])
def decide_view(request, pk):
    """POST /api/energy-manager/recommendations/<id>/decide/  { "status": "accepted" | "rejected" }"""
    status_value = (request.data or {}).get('status')
    if status_value not in (Recommendation.Status.ACCEPTED, Recommendation.Status.REJECTED):
        return Response({'error': 'status must be "accepted" or "rejected"'}, status=400)

    try:
        rec = Recommendation.objects.get(pk=pk)
    except Recommendation.DoesNotExist:
        return Response({'error': 'not found'}, status=404)

    rec.status = status_value
    rec.decided_at = timezone.now()
    rec.save(update_fields=['status', 'decided_at'])
    return Response(RecommendationSerializer(rec).data)
