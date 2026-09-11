from abc import ABC, abstractmethod
from typing import AsyncGenerator, BinaryIO

class StorageAdapter(ABC):
    @abstractmethod
    async def upload_stream(self, key: str, stream: AsyncGenerator[bytes, None]) -> str:
        """Uploads a stream of bytes to storage at the specified key."""
        pass

    @abstractmethod
    async def download_stream(self, key: str, chunk_size: int = 65536) -> AsyncGenerator[bytes, None]:
        """Yields chunks of bytes from storage for the specified key."""
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Deletes object at key from storage."""
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Checks whether object exists in storage."""
        pass
