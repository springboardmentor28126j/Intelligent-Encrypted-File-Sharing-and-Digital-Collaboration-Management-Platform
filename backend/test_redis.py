from redis_client import redis_client, test_redis


if __name__ == "__main__":

    connected = test_redis()

    if not connected:
        print("Redis is not available.")
        exit()

    redis_client.set(
        "project_name",
        "Intelligent File Sharing"
    )

    print("Redis value stored successfully.")

    value = redis_client.get(
        "project_name"
    )

    print("Redis value:", value)
