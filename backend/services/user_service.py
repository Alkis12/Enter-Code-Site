from models.user import User

async def get_by_tg_username(tg_username: str):
    return await User.find(User.tg_username == tg_username).first_or_none()

async def get_by_email(email: str):
    return await User.find(User.email == email).first_or_none()

async def get_by_id(user_id: str):
    return await User.get(user_id)

async def get_by_role(role: str):
    return await User.find(User.role == role).to_list()

async def update_user(user_id: str, **kwargs):
    user = await User.get(user_id)
    if not user:
        return None
    for key, value in kwargs.items():
        setattr(user, key, value)
    await user.save()
    return user

async def delete_user(user_id: str):
    user = await User.get(user_id)
    if user:
        await user.delete()
        return True
    return False

async def exists(tg_username: str):
    user = await get_by_tg_username(tg_username)
    return user is not None
