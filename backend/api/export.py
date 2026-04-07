"""Export API — download answers as PDF, markdown, or JSON."""
import json
import uuid
from pathlib import Path
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.auth.utils import get_current_user
from backend.core.config import settings
from backend.core.database import DB_PATH

router = APIRouter()


class ExportRequest(BaseModel):
    query_ids: List[str]
    format: str = "markdown"  # markdown | pdf | json


@router.post("/")
async def export_answers(req: ExportRequest, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        placeholders = ",".join("?" * len(req.query_ids))
        async with db.execute(
            f"SELECT * FROM query_history WHERE id IN ({placeholders})",
            req.query_ids,
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

    for row in rows:
        row["sources"] = json.loads(row.get("sources") or "[]")

    export_id = str(uuid.uuid4())
    filename = f"ragnarok_export_{export_id}"

    if req.format == "json":
        out_path = settings.EXPORTS_DIR / f"{filename}.json"
        out_path.write_text(json.dumps(rows, indent=2))
        return FileResponse(str(out_path), filename=f"{filename}.json", media_type="application/json")

    elif req.format == "markdown":
        lines = ["# RAGNAROK — Exported Answers\n"]
        for row in rows:
            lines.append(f"## Query\n{row['query']}\n")
            lines.append(f"## Answer\n{row['answer']}\n")
            if row["sources"]:
                lines.append("## Sources")
                for src in row["sources"]:
                    lines.append(f"- [{src.get('filename', 'Unknown')}] page {src.get('page', '?')}")
            lines.append(f"\n---\n*Model: {row.get('model_used')} | Latency: {row.get('latency_ms')}ms*\n\n")

        out_path = settings.EXPORTS_DIR / f"{filename}.md"
        out_path.write_text("\n".join(lines))
        return FileResponse(str(out_path), filename=f"{filename}.md", media_type="text/markdown")

    elif req.format == "pdf":
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib.units import inch

            out_path = settings.EXPORTS_DIR / f"{filename}.pdf"
            doc = SimpleDocTemplate(str(out_path), pagesize=letter)
            styles = getSampleStyleSheet()
            story = []

            story.append(Paragraph("RAGNAROK — Exported Answers", styles["Title"]))
            story.append(Spacer(1, 0.2 * inch))

            for row in rows:
                story.append(Paragraph(f"<b>Query:</b> {row['query']}", styles["Heading2"]))
                story.append(Paragraph(row["answer"], styles["Normal"]))
                story.append(Spacer(1, 0.1 * inch))
                if row["sources"]:
                    story.append(Paragraph("<b>Sources:</b>", styles["Normal"]))
                    for src in row["sources"]:
                        story.append(Paragraph(
                            f"• {src.get('filename', '?')} (page {src.get('page', '?')})",
                            styles["Normal"],
                        ))
                story.append(Spacer(1, 0.3 * inch))

            doc.build(story)
            return FileResponse(str(out_path), filename=f"{filename}.pdf", media_type="application/pdf")
        except ImportError:
            raise HTTPException(status_code=400, detail="reportlab not installed; use markdown or json format")

    raise HTTPException(status_code=400, detail=f"Unknown format: {req.format}")
