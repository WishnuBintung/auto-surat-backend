import logging
import os
from enum import Enum
from django.conf import settings
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# 1. Definisikan Enum kaku berdasarkan daftar kode surat resmi di database
class SuratIntentEnum(str, Enum):
    SI_MAG = "SI-MAG"
    SI_SUR = "SI-SUR"
    SK_BEA = "SK-BEA"
    SK_KUL = "SK-KUL"
    SP_MAG = "SP-MAG"
    SP_SKC = "SP-SKC"
    SP_TAS = "SP-TAS"
    SP_TRA = "SP-TRA"
    SR_BEA = "SR-BEA"
    SR_MAG = "SR-MAG"

# 2. Definisikan Struktur Output Pydantic
class IntentRouterOutput(BaseModel):
    kode_surat: SuratIntentEnum | None = Field(
        description="Kode surat resmi yang paling sesuai dengan maksud pengguna. Jika sama sekali tidak jelas, kembalikan null."
    )
    alasan: str = Field(description="Alasan singkat mengapa kode surat tersebut dipilih.")

def route_intent_with_ai(user_message: str) -> str | None:
    """
    Lapis kedua: Menggunakan AI dengan Pydantic Structured Outputs 
    ketika keyword matching gagal (mengembalikan None).
    """
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY belum dikonfigurasi untuk AI Intent Router.")
        return None

    timeout_sec = float(getattr(settings, "AGENT_TIMEOUT_SECONDS", 15.0))
    client = genai.Client(
        api_key=str(api_key).strip(),
        http_options=types.HttpOptions(timeout=int(timeout_sec * 1000)),
    )
    model_name = getattr(settings, "GEMINI_MODEL_NAME", "gemini-2.5-flash")
    
    prompt = f"""
    Analisis pesan dari mahasiswa berikut dan tentukan jenis surat apa yang mereka inginkan.
    Pesan User: "{user_message}"
    
    Pilih HANYA dari daftar kode surat yang tersedia pada skema yang ditentukan. 
    Jika kalimat user sama sekali tidak jelas atau bukan permohonan surat, set nilai kode_surat menjadi null.
    """

    try:
        # Memanggil LLM dengan paksaan struktur Pydantic (Structured Outputs)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': IntentRouterOutput,
                'temperature': 0.0,  # Set 0 agar deterministik dan tidak berhalusinasi
            },
        )
        
        # Parse hasil JSON dari AI ke model Pydantic
        result = IntentRouterOutput.model_validate_json(response.text)
        return result.kode_surat.value if result.kode_surat else None

    except Exception as e:
        # Jaring pengaman jika AI error (misal: 503 atau format meleset)
        logger.warning("AI Router Error: %s", e)
        return None