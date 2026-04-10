from fastapi import APIRouter, HTTPException
import requests

from core.config import YELP_API_KEY

router = APIRouter(tags=["locations"])

@router.get("/fields/search")
def search_fields(location: str, sort_by: str = "best_match"):
    if not YELP_API_KEY:
        raise HTTPException(status_code=500, detail="Yelp API key not configured")
    
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")
    
    url = "https://api.yelp.com/v3/businesses/search"
    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
    params = {
        "location": location,
        "term": "sports fields and facilities",
        "sort_by": sort_by,
        "limit": 20,
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail="Failed to fetch data from Yelp API"
            )
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error connecting to Yelp API: {str(e)}")
