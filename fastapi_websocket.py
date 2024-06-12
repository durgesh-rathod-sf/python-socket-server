# from fastapi import FastAPI, WebSocket
# from fastapi.responses import HTMLResponse

# #
# from amazon_transcribe.client import TranscribeStreamingClient
# from amazon_transcribe.handlers import TranscriptResultStreamHandler
# from amazon_transcribe.model import TranscriptEvent
# from amazon_transcribe.utils import apply_realtime_delay


# REGION = "us-east-1"
# SAMPLE_RATE = 44100  # Set this to the sample rate of your audio
# BYTES_PER_SAMPLE = 2  # Typically 2 bytes for 16-bit audio
# CHANNEL_NUMS = 1  # Set this to the number of channels in your audio
# CHUNK_SIZE = 1024 * 8
# PORT = 8888


# class MyEventHandler(TranscriptResultStreamHandler):
#     async def handle_transcript_event(self, transcript_event: TranscriptEvent):
#         results = transcript_event.transcript.results
#         for result in results:
#             if not result.is_partial:
#                 for alt in result.alternatives:
#                     print(alt.transcript)


# app = FastAPI()

# html = """
# Hello world
# """


# @app.get("/")
# async def get():
#     return HTMLResponse(html)


# @app.websocket("/ws")
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     while True:
#         data = await websocket.receive_text()
#         await websocket.send_text(f"Message text was: {data}")


import asyncio
import socket
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
from amazon_transcribe.utils import apply_realtime_delay


REGION = "us-east-1"
SAMPLE_RATE = 44100  # Set this to the sample rate of your audio
BYTES_PER_SAMPLE = 2  # Typically 2 bytes for 16-bit audio
CHANNEL_NUMS = 1  # Set this to the number of channels in your audio
CHUNK_SIZE = 1024 * 8
PORT = 8888

app = FastAPI()

html = """
<!DOCTYPE html>
<html>
    <head>
        <title>WebSocket</title>
    </head>
    <body>
        <h1>Hello world</h1>
    </body>
</html>
"""


class MyEventHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        results = transcript_event.transcript.results
        for result in results:
            if not result.is_partial:
                for alt in result.alternatives:
                    print(alt.transcript)


async def basic_transcribe():
    print("basic_transcribe called")
    client = TranscribeStreamingClient(region=REGION)
    stream = await client.start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=SAMPLE_RATE,
        media_encoding="pcm",
    )

    async def receive_chunks():
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.bind(("127.0.0.1", PORT))
        server_socket.listen(1)
        print(f"Server listening on port {PORT}")

        connection, address = server_socket.accept()
        print(f"Connection from {address}")

        while True:
            audio_chunk = connection.recv(CHUNK_SIZE)
            print(audio_chunk)
            if not audio_chunk:
                break

            await stream.input_stream.send_audio_event(audio_chunk)

        await stream.input_stream.end_stream()
        connection.close()
        server_socket.close()

    handler = MyEventHandler(stream.output_stream)
    await asyncio.gather(receive_chunks(), handler.handle_events())


@app.get("/")
async def get():
    return HTMLResponse(html)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print("ENDPOINT '/ws' called")
    await websocket.accept()
    client = TranscribeStreamingClient(region=REGION)
    stream = await client.start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=SAMPLE_RATE,
        media_encoding="pcm",
    )

    handler = MyEventHandler(stream.output_stream)

    async def receive_chunks():
        while True:
            data = await websocket.receive_bytes()
            if not data:
                break
            await stream.input_stream.send_audio_event(data)

        await stream.input_stream.end_stream()

    await asyncio.gather(receive_chunks(), handler.handle_events())
