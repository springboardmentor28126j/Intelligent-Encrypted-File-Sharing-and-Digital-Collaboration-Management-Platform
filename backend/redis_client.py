import redis


# =========================================================
# REDIS CONNECTION
# =========================================================

REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6379
REDIS_DB = 0


redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    decode_responses=True
)


# =========================================================
# TEST REDIS CONNECTION
# =========================================================

def test_redis():

    try:

        response = redis_client.ping()

        print("Redis connection successful.")

        return response

    except Exception as error:

        print(
            "Redis connection failed:",
            error
        )

        return False