# 👗 StyleMe Free Open-Source 3D Microservice (Pillar 1)

This service provides free, GPU-accelerated 3D model generation and virtual garment fitting powered by **Stability AI's TripoSR** and **FastAPI**, with a public HTTPS tunnel provided by **Cloudflare Tunnel (`cloudflared`)**.

---

## 🚀 Quick Setup (Google Colab - 100% Free)

1. Open [Google Colab](https://colab.research.google.com).
2. Click **Upload** and upload `StyleMe_3D_Colab.ipynb` from this folder.
3. Make sure GPU is enabled:
   - Go to **Runtime → Change runtime type** → select **T4 GPU** → click **Save**.
4. Click **Runtime → Run all** (or run each cell top-to-bottom).
5. At the end of Cell 5, Colab will print:
   ```
   =================================================================
   🚀 YOUR FREE 3D AI SERVICE IS LIVE!
      URL: https://xxxx-xxxx-xxxx.trycloudflare.com

   👉 Copy this URL and paste it in Thinktech/apps/api/.env:
      TRIPOSR_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
   =================================================================
   ```
6. Open [`Thinktech/apps/api/.env`](../../apps/api/.env) and set:
   ```env
   TRIPOSR_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
   ```
7. Refresh your StyleMe web app and click **Try it on**! Your 3D models will generate directly on the Colab T4 GPU in ~1.5 seconds.

---

## 💻 Running Locally (If you have an NVIDIA GPU)

If your local computer has an NVIDIA GPU (RTX 3060/4060 or better):

```bash
cd services/triposr-colab
pip install -r requirements.txt
python server.py
```

Then in `apps/api/.env`:

```env
TRIPOSR_URL=http://localhost:8000
```
