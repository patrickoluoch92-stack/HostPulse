export interface GooglePlacesTextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  website?: string;
  international_phone_number?: string;
  formatted_phone_number?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
  }>;
}

export interface GooglePlacesTextSearchResponse {
  status: string;
  error_message?: string;
  results: GooglePlacesTextSearchResult[];
}

