from fastapi import FastAPI, HTTPException
from fastapi import Body
import uvicorn
from contextlib import asynccontextmanager
from database import init_database, close_database
from models.user import User
from models.user import add_user_to_db
from requests import UserCreateRequest

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    yield
    await close_database()

app = FastAPI(title="Enter Code Site", lifespan=lifespan)

@app.get('/', summary="Главная страница", tags=["Основные"])
def root():
    return {"message": "Добро пожаловать на Enter Code Site!"}

@app.get('/users', summary="Список всех пользователей", tags=["Пользователи"])
async def get_users():
    users = await User.find_all().to_list()
    return users

@app.post('/users', summary="Добавить пользователя", tags=["Пользователи"])
async def create_user(user_data: UserCreateRequest = Body(...)):
    if await User.find_one(User.tg_username == user_data.tg_username):
        raise HTTPException(status_code=400, detail="Пользователь с таким именем пользователя Telegram уже существует")
    if user_data.phone and await User.find_one(User.phone == user_data.phone):
        raise HTTPException(status_code=400, detail="Пользователь с таким телефоном уже существует")
    user = User(**user_data.model_dump())
    await add_user_to_db(user)
    return user

if __name__ == "__main__":
    uvicorn.run("main:app")
