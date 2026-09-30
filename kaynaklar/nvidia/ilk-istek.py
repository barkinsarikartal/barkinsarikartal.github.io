"""NVIDIA üzerinde ilk metin isteği. Python 3; ek paket gerekmez."""
import getpass
import json
import os
import urllib.error
import urllib.request


def main():
    key = os.getenv("NVIDIA_API_KEY") or getpass.getpass("NVIDIA API anahtarı (gizli): ")
    if not key.strip():
        raise SystemExit("API anahtarı boş olamaz.")
    # Güncel model kimliğini model sayfasındaki API örneğinden kontrol et.
    model = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "API nedir? Türkçe, iki kısa cümleyle açıkla."}],
        "temperature": 0.2,
        "max_tokens": 256,
        "stream": False,
    }
    request = urllib.request.Request(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + key.strip(), "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.load(response)
        content = result["choices"][0]["message"].get("content")
        print(content or "Metin yanıtı boş. Modelin API örneğini ve çıktı sınırını kontrol et.")
    except urllib.error.HTTPError as error:
        hints = {401: "API anahtarını kontrol et.", 403: "Hesap doğrulaması ve model erişimini kontrol et.",
                 404: "Model kimliğini ve endpoint adresini kontrol et.",
                 429: "İstek sınırına ulaşıldı; bekleyip yeniden dene."}
        raise SystemExit(f"HTTP {error.code}: " + hints.get(error.code, "NVIDIA durumunu ve modelin API örneğini kontrol et."))
    except (urllib.error.URLError, TimeoutError):
        raise SystemExit("Bağlantı kurulamadı veya istek zaman aşımına uğradı.")
    except (KeyError, IndexError, TypeError, ValueError):
        raise SystemExit("Beklenen yanıt biçimi alınamadı. Modelin API örneğini kontrol et.")


if __name__ == "__main__":
    main()
