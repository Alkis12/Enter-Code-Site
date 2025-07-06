from fastapi import FastAPI, HTTPException
from fastapi import Body
from pydantic import BaseModel
import uvicorn
from contextlib import asynccontextmanager
from database import init_database, close_database
from models.user import User, UserType, UserStatus
from models.user import add_user_to_db

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

class UserCreateRequest(BaseModel):
    name: str
    surname: str
    email: str
    user_type: UserType
    status: UserStatus = UserStatus.ACTIVE
    phone: str | None = None
    avatar_url: str | None = None
    bio: str | None = None

@app.get('/user_0', summary="Добавить тестового пользователя", tags=["Пользователи"])
async def create_user_example():
    user = User(
        name="Иван",
        surname="Иванов",
        email="ivan.ivanov@example.com",
        user_type="student",
        status="active",
        group_id="507f1f77bcf86cd799439011",
        phone="+7 (999) 123-45-67",
        bio="Студент номер 0"
    )
    await add_user_to_db(user)
    print(f"Полное имя: {user.full_name}")
    print(f"Активен: {user.is_active()}")
    print(f"Тип пользователя: {user.user_type.value.capitalize()}")
    return str(user)

@app.post('/users', summary="Добавить пользователя", tags=["Пользователи"])
async def create_user(user_data: UserCreateRequest = Body(...)):
    if await User.find_one(User.email == user_data.email):
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    if user_data.phone and await User.find_one(User.phone == user_data.phone):
        raise HTTPException(status_code=400, detail="Пользователь с таким телефоном уже существует")
    user = User(**user_data.model_dump())
    await add_user_to_db(user)
    return user

@app.get('/db_check', summary="Проверка подключения к базе данных", tags=["DataBase"])
async def db_check():
    try:
        return {"message": f"База данных работает!"}
    except Exception as e:
        return {"error": f"Ошибка подключения к базе данных: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run("main:app")
