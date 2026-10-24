"""
StyleMe Free Open-Source 3D Virtual Try-On Server (Pillar 1)
Powered by Stability AI's TripoSR + FastAPI + Cloudflare Tunnel.
Run on Google Colab (Free T4 GPU) or locally.
"""

import os
import io
import re
import uuid
import base64
import requests
import uvicorn
import torch
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from PIL import Image

try:
    import rembg
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False

try:
    from tsr.system import TSR
    HAS_TSR = True
except ImportError:
    HAS_TSR = False

app = FastAPI(title="StyleMe Open-Source 3D Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FILES_DIR = os.path.join(os.getcwd(), "styleme_output_files")
os.makedirs(FILES_DIR, exist_ok=True)

# Device & Model
device = "cuda:0" if torch.cuda.is_available() else "cpu"
tsr_model = None

if HAS_TSR:
    print(f"Loading TripoSR model on {device}...")
    try:
        tsr_model = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt",
        )
        tsr_model.renderer.set_chunk_size(8192)
        tsr_model.to(device)
        print("TripoSR loaded successfully!")
    except Exception as e:
        print(f"Warning: Could not load TripoSR ({e}). Running in fallback mode.")

class TryOnRequest(BaseModel):
    person: str
    garment_image_url: str
    category: str = "tops"

class Model3dRequest(BaseModel):
    image_url: str

def get_base_url(request: Request) -> str:
    # Use forward host / tunnel host
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", "localhost:8000"))
    return f"{proto}://{host}"

def load_image_from_source(source: str) -> Image.Image:
    if source.startswith("data:image/"):
        header, encoded = source.split(",", 1)
        data = base64.b64decode(encoded)
        return Image.open(io.BytesIO(data)).convert("RGBA")
    elif source.startswith("http://") or source.startswith("https://"):
        res = requests.get(source, timeout=15)
        res.raise_for_status()
        return Image.open(io.BytesIO(res.content)).convert("RGBA")
    else:
        raise ValueError("Unsupported image source (must be data URI or http URL)")

@app.get("/")
@app.get("/health")
def health(request: Request):
    return {
        "status": "ready",
        "service": "StyleMe 3D Microservice (Pillar 1)",
        "model": "Stability AI TripoSR",
        "device": device,
        "gpu_available": torch.cuda.is_available(),
        "has_triposr": tsr_model is not None,
    }

@app.post("/try-on")
async def try_on(req: TryOnRequest, request: Request):
    try:
        req_id = f"tryon-{uuid.uuid4().hex[:12]}"
        person_img = load_image_from_source(req.person)
        garment_img = load_image_from_source(req.garment_image_url)

        # Remove background of garment if rembg is available
        if HAS_REMBG:
            garment_nobg = rembg.remove(garment_img)
        else:
            garment_nobg = garment_img

        # Natural garment fitting / overlay onto person
        pw, ph = person_img.size
        gw, gh = garment_nobg.size

        if req.category in ["tops", "upper_body"]:
            target_w = int(pw * 0.70)
            target_h = int(gh * (target_w / max(gw, 1)))
            pos_x = int((pw - target_w) / 2)
            pos_y = int(ph * 0.22)
        elif req.category in ["bottoms", "lower_body"]:
            target_w = int(pw * 0.65)
            target_h = int(gh * (target_w / max(gw, 1)))
            pos_x = int((pw - target_w) / 2)
            pos_y = int(ph * 0.50)
        else:  # one-piece / dresses
            target_w = int(pw * 0.75)
            target_h = int(gh * (target_w / max(gw, 1)))
            pos_x = int((pw - target_w) / 2)
            pos_y = int(ph * 0.22)

        resized_garment = garment_nobg.resize((max(target_w, 1), max(target_h, 1)), Image.Resampling.LANCZOS)
        dressed = person_img.copy()
        dressed.paste(resized_garment, (pos_x, pos_y), mask=resized_garment)

        # Save result
        out_filename = f"{req_id}.jpg"
        out_path = os.path.join(FILES_DIR, out_filename)
        dressed.convert("RGB").save(out_path, format="JPEG", quality=92)

        base_url = get_base_url(request)
        file_url = f"{base_url}/files/{out_filename}"

        return {
            "request_id": req_id,
            "status": "COMPLETED",
            "output": {
                "images": [{"url": file_url}],
            },
            "status_url": f"{base_url}/status/{req_id}",
            "response_url": f"{base_url}/status/{req_id}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Try-on generation failed: {str(e)}")

@app.post("/generate-3d")
async def generate_3d(req: Model3dRequest, request: Request):
    try:
        req_id = f"3d-{uuid.uuid4().hex[:12]}"
        img = load_image_from_source(req.image_url)

        out_filename = f"{req_id}.glb"
        out_path = os.path.join(FILES_DIR, out_filename)

        if tsr_model is not None:
            # 1. Remove background for clean 3D reconstruction
            if HAS_REMBG:
                nobg = rembg.remove(img)
            else:
                nobg = img

            # 2. Extract 3D representation via TripoSR
            with torch.no_grad():
                scene_codes = tsr_model([nobg], device=device)
                meshes = tsr_model.extract_mesh(scene_codes, has_vertex_color=True, resolution=256)
                mesh = meshes[0]
                # Export to standard binary GLTF (GLB)
                mesh.export(out_path, file_type="glb")
        else:
            # Synthetic GLB fallback if model not loaded
            import trimesh
            box = trimesh.creation.box(extents=[1, 1.8, 0.4])
            box.visual.vertex_colors = [210, 105, 30, 255]
            box.export(out_path, file_type="glb")

        base_url = get_base_url(request)
        file_url = f"{base_url}/files/{out_filename}"

        return {
            "request_id": req_id,
            "status": "COMPLETED",
            "output": {
                "model_mesh": {"url": file_url},
                "model_glb": {"url": file_url},
            },
            "status_url": f"{base_url}/status/{req_id}",
            "response_url": f"{base_url}/status/{req_id}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"3D generation failed: {str(e)}")

@app.get("/status/{req_id}")
def check_status(req_id: str, request: Request):
    base_url = get_base_url(request)
    glb_path = os.path.join(FILES_DIR, f"{req_id}.glb")
    jpg_path = os.path.join(FILES_DIR, f"{req_id}.jpg")

    if os.path.exists(glb_path):
        return {
            "status": "COMPLETED",
            "output": {"model_mesh": {"url": f"{base_url}/files/{req_id}.glb"}},
        }
    if os.path.exists(jpg_path):
        return {
            "status": "COMPLETED",
            "output": {"images": [{"url": f"{base_url}/files/{req_id}.jpg"}]},
        }
    return {"status": "IN_PROGRESS"}

@app.get("/files/{filename}")
def serve_file(filename: str):
    # Security check: prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = os.path.join(FILES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    content_type = "model/gltf-binary" if filename.endswith(".glb") else "image/jpeg"
    return FileResponse(path, media_type=content_type)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

