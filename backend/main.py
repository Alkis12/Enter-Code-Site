from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get('/', summary="Main ручка", tags=["Ура, ручки"])
def root():
    return "Hello world"


if __name__ == "__main__":
    uvicorn.run("main:app")
