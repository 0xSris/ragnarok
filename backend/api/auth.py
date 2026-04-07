"""Auth API endpoints — login, register, me."""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import aiosqlite

from backend.auth.utils import (
    authenticate_user, create_access_token, hash_password, get_current_user
)
from backend.core.database import DB_PATH

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str = None


@router.post("/login")
async def login(req: LoginRequest):
    user = await authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token({"sub": user["id"], "username": user["username"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
    }


@router.post("/register")
async def register(req: RegisterRequest):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id FROM users WHERE username = ?", (req.username,)
        ) as cur:
            if await cur.fetchone():
                raise HTTPException(status_code=400, detail="Username already taken")

        user_id = str(uuid.uuid4())
        hashed = hash_password(req.password)
        await db.execute(
            "INSERT INTO users (id, username, email, hashed_password) VALUES (?,?,?,?)",
            (user_id, req.username, req.email, hashed),
        )
        await db.commit()

    token = create_access_token({"sub": user_id, "username": req.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return current_user
