from passlib.context import CryptContext

pwd_cst=CryptContext(schemes=["bcrypt"], deprecated="auto")

class Encrypting():
    def bcrypt(password:str):
        return pwd_cst.hash(password)
    
    def Varify(plain_password,hashed_password):
        return pwd_cst.verify(plain_password, hashed_password)