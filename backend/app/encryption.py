from passlib.context import CryptContext

pwd_cst=CryptContext(schemes=["bcrypt"], deprecated="auto")

class Encrypting():
    @staticmethod
    def bcrypt(password:str):
        return pwd_cst.hash(password)
    
    @staticmethod
    def Varify(plain_password,hashed_password):
        return pwd_cst.verify(plain_password, hashed_password)