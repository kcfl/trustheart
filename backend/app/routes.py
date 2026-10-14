"""FastAPI route handlers for TrustHeart 3D /api endpoints."""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.schemas import (
    HealthResponse,
    MetaResponse,
    ModelExportResponse,
    PredictRequest,
    PredictResponse,
    SamplesResponse,
)
from backend.app.service import ModelService, get_model_service

router = APIRouter(prefix="/api", tags=["trustheart"])


@router.get("/health", response_model=HealthResponse)
def get_health(service: ModelService = Depends(get_model_service)) -> HealthResponse:
    """Check backend operational health, model verification status, and clinical disclaimer."""
    return service.get_health()


@router.get("/meta", response_model=MetaResponse)
def get_metadata(service: ModelService = Depends(get_model_service)) -> MetaResponse:
    """Retrieve mode definitions (quick: 7, full: 55) and feature schemas with training stats."""
    return service.get_meta()


@router.get("/samples", response_model=SamplesResponse)
def get_samples(service: ModelService = Depends(get_model_service)) -> SamplesResponse:
    """Retrieve 4 representative deterministic demo patient profiles from out-of-fold data."""
    return service.get_samples()


@router.get("/model-export", response_model=ModelExportResponse)
def get_model_export(
    mode: Literal["quick", "full"] = Query("quick", description="Model mode ('quick' or 'full')"),
    service: ModelService = Depends(get_model_service),
) -> ModelExportResponse:
    """Export standardized weights, intercept, Platt parameters, and defaults for browser prediction."""
    try:
        return service.get_model_export(mode=mode)
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )


@router.post("/predict", response_model=PredictResponse)
def predict(
    request: PredictRequest,
    service: ModelService = Depends(get_model_service),
) -> PredictResponse:
    """Run validated prediction with Platt calibration, Fréchet coherence bounds, and trust stats."""
    return service.predict(request)
