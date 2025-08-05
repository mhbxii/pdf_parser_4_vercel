import os
import fitz  # PyMuPDF
from io import BytesIO

def parse_pdf(file_bytes):
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    if len(doc) > 5:
        return None, "PDF has more than 5 pages"
    
    text = ""
    for page in doc:
        text += page.get_text()
    
    if len(text) > 10000:
        text = text[:10000]
    
    return text.strip(), None

def handler(event, context):
    try:
        # Parse multipart body
        body = event["body"]
        file_bytes = BytesIO(body.encode("latin1")).getvalue()

        if len(file_bytes) > 5 * 1024 * 1024:
            return {
                "statusCode": 400,
                "body": '{"error":"File too large (max 5MB)"}'
            }

        text, err = parse_pdf(file_bytes)
        if err:
            return {
                "statusCode": 400,
                "body": '{"error":"' + err + '"}'
            }

        return {
            "statusCode": 200,
            "body": '{"text":' + json.dumps(text) + '}',
            "headers": {"Content-Type": "application/json"}
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": '{"error":"' + str(e) + '"}'
        }
