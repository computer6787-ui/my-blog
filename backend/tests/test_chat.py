import unittest
import sys
import os

# Add root directory to sys.path so 'backend' is recognized as a package
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import base, get_db
from backend.app import models
from backend.routers.auth import create_access_token
import backend.routers.chat as chat_router


# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

chat_router.SessionLocal = TestingSessionLocal



def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


class TestChatEndpoints(unittest.TestCase):
    def setUp(self):
        base.metadata.create_all(bind=engine)
        db = TestingSessionLocal()

        user1 = models.User(
            id=1,
            name="Alice Walker",
            email="alice@lumora.test",
            hashed_password="hashedpassword123",
            role="author",
            is_active=True,
        )
        user2 = models.User(
            id=2,
            name="Bob Builder",
            email="bob@lumora.test",
            hashed_password="hashedpassword123",
            role="moderator",
            is_active=True,
        )
        user3 = models.User(
            id=3,
            name="Charlie Dev",
            email="charlie@lumora.test",
            hashed_password="hashedpassword123",
            role="admin",
            is_active=True,
        )
        db.add_all([user1, user2, user3])
        db.commit()

        g_msg = models.GlobalMessage(
            id=1,
            user_id=1,
            author_name="Alice Walker",
            message_body="Welcome to Lumora global live stream!",
        )
        p_msg = models.PrivateMessage(
            id=1,
            sender_id=1,
            receiver_id=2,
            message_body="Hey Bob, check out my latest story draft.",
            is_read=False,
        )
        db.add_all([g_msg, p_msg])
        db.commit()
        db.close()

    def tearDown(self):
        base.metadata.drop_all(bind=engine)



    def test_get_global_history(self):
        response = client.get("/chat/global/history")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]["message_body"], "Welcome to Lumora global live stream!")
        self.assertEqual(data[0]["author_name"], "Alice Walker")

    def test_get_user_directory(self):
        token = create_access_token(data={"sub": "alice@lumora.test", "id": 1, "role": "author"})
        response = client.get("/chat/users", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(response.status_code, 200)
        users = response.json()
        self.assertEqual(len(users), 3)
        names = [u["name"] for u in users]
        self.assertIn("Alice Walker", names)
        self.assertIn("Bob Builder", names)

    def test_get_conversations_and_unread_count(self):
        token = create_access_token(data={"sub": "bob@lumora.test", "id": 2, "role": "moderator"})
        headers = {"Authorization": f"Bearer {token}"}

        # Bob checks conversations
        resp = client.get("/chat/conversations", headers=headers)
        self.assertEqual(resp.status_code, 200)
        convs = resp.json()
        self.assertEqual(len(convs), 1)
        self.assertEqual(convs[0]["user"]["id"], 1)
        self.assertEqual(convs[0]["unread_count"], 1)

        # Bob checks unread count
        resp_unread = client.get("/chat/unread-count", headers=headers)
        self.assertEqual(resp_unread.status_code, 200)
        self.assertEqual(resp_unread.json()["unread_count"], 1)

        # Bob marks conversation as read
        resp_read = client.post("/chat/private/1/read", headers=headers)
        self.assertEqual(resp_read.status_code, 200)
        self.assertEqual(resp_read.json()["marked_read"], 1)

        # Bob checks unread count again
        resp_unread2 = client.get("/chat/unread-count", headers=headers)
        self.assertEqual(resp_unread2.status_code, 200)
        self.assertEqual(resp_unread2.json()["unread_count"], 0)

    def test_private_history(self):
        token = create_access_token(data={"sub": "alice@lumora.test", "id": 1, "role": "author"})
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.get("/chat/private/2/history", headers=headers)
        self.assertEqual(resp.status_code, 200)
        messages = resp.json()
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["message_body"], "Hey Bob, check out my latest story draft.")
        self.assertEqual(messages[0]["receiver_id"], 2)

    def test_websocket_global_and_private(self):
        token = create_access_token(data={"sub": "alice@lumora.test", "id": 1, "role": "author"})

        with client.websocket_connect(f"/chat/ws/chat?token={token}") as ws:
            # First packet received is auth_success
            init_data = ws.receive_json()
            if init_data.get("type") == "presence_update":
                init_data = ws.receive_json()
            self.assertEqual(init_data["type"], "auth_success")
            self.assertEqual(init_data["data"]["user"]["name"], "Alice Walker")

            # Send a global message
            ws.send_json({
                "type": "global_message",
                "message": "Hello from WebSocket test!"
            })

            msg = ws.receive_json()
            while msg.get("type") == "presence":
                msg = ws.receive_json()

            self.assertEqual(msg["type"], "global_message")
            self.assertEqual(msg["data"]["message_body"], "Hello from WebSocket test!")
            self.assertEqual(msg["data"]["author_name"], "Alice Walker")

            # Send a private message to Bob (id: 2)
            ws.send_json({
                "type": "private_message",
                "recipient_id": 2,
                "message": "Secret note to Bob"
            })

            p_msg = ws.receive_json()
            while p_msg.get("type") == "presence":
                p_msg = ws.receive_json()

            self.assertEqual(p_msg["type"], "private_message")
            self.assertEqual(p_msg["data"]["message_body"], "Secret note to Bob")
            self.assertEqual(p_msg["data"]["receiver_id"], 2)



    def test_search_chat_users(self):
        token = create_access_token(data={"sub": "alice@lumora.test", "id": 1, "role": "author"})
        resp = client.get("/chat/users?q=bob", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200)
        users = resp.json()
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0]["name"], "Bob Builder")

    def test_guest_websocket_global_message(self):
        with client.websocket_connect("/chat/ws/chat") as ws:
            init_data = ws.receive_json()
            if init_data.get("type") == "presence_update":
                init_data = ws.receive_json()
            self.assertEqual(init_data["type"], "guest_connected")

            ws.send_json({
                "type": "global_message",
                "guest_name": "Guest Explorer",
                "message": "Hello from a guest session!"
            })

            msg = ws.receive_json()
            while msg.get("type") == "presence":
                msg = ws.receive_json()

            self.assertEqual(msg["type"], "global_message")
            self.assertEqual(msg["data"]["message_body"], "Hello from a guest session!")
            self.assertEqual(msg["data"]["author_name"], "Guest Explorer")
            self.assertEqual(msg["data"]["author_role"], "guest")

    def test_websocket_typing_and_read_receipt(self):
        token_alice = create_access_token(data={"sub": "alice@lumora.test", "id": 1, "role": "author"})
        token_bob = create_access_token(data={"sub": "bob@lumora.test", "id": 2, "role": "moderator"})

        with client.websocket_connect(f"/chat/ws/chat?token={token_alice}") as ws_alice:
            with client.websocket_connect(f"/chat/ws/chat?token={token_bob}") as ws_bob:
                # Alice sends typing indicator to Bob
                ws_alice.send_json({
                    "type": "typing",
                    "channel": "private",
                    "recipient_id": 2,
                    "is_typing": True,
                })

                msg = ws_bob.receive_json()
                while msg.get("type") in ["presence_update", "auth_success"]:
                    msg = ws_bob.receive_json()

                self.assertEqual(msg["type"], "typing")
                self.assertEqual(msg["data"]["user_id"], 1)
                self.assertEqual(msg["data"]["recipient_id"], 2)
                self.assertTrue(msg["data"]["is_typing"])

                # Bob sends read receipt for Alice's messages
                ws_bob.send_json({
                    "type": "read_receipt",
                    "sender_id": 1,
                })

                receipt = ws_alice.receive_json()
                while receipt.get("type") in ["presence_update", "auth_success"]:
                    receipt = ws_alice.receive_json()

                self.assertEqual(receipt["type"], "read_receipt")
                self.assertEqual(receipt["data"]["reader_id"], 2)
                self.assertEqual(receipt["data"]["sender_id"], 1)


if __name__ == "__main__":
    unittest.main()


