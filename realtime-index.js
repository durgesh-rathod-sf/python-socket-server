const {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} = require("@aws-sdk/client-transcribe-streaming");

const { createReadStream, readdirSync, watch } = require("fs");
const { join } = require("path");
const fs = require("fs");

const { PassThrough } = require("stream");
const readline = require("readline");
const credentials = {
  accessKeyId: "",
  secretAccessKey: "",
};

const LanguageCode = "en-US";
const MediaEncoding = "flac";
const MediaSampleRateHertz = 44100;
transcript = "";
// Function to log with updating the same line
function logUpdate(message) {
  // Clear the current line
  readline.clearLine(process.stdout, 0);
  // Move the cursor to the beginning of the line
  readline.cursorTo(process.stdout, 0);
  // Write the new message
  process.stdout.write(message);
}

// Function to initiate transcription for a file
async function startTranscriptionForFile(filePath, client) {
  const audioSource = createReadStream(filePath);
  const audioPayloadStream = new PassThrough({ highWaterMark: 4 * 1024 });
  audioSource.pipe(audioPayloadStream);

  return new Promise(async (resolve, reject) => {
    const params = {
      LanguageCode,
      MediaEncoding,
      MediaSampleRateHertz,
      AudioStream: (async function* () {
        for await (const chunk of audioPayloadStream) {
          yield { AudioEvent: { AudioChunk: chunk } };
        }
      })(),
    };

    const command = new StartStreamTranscriptionCommand(params);

    try {
      const response = await client.send(command);
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent && event.TranscriptEvent.Transcript.Results.length) {
          const alternatives = event.TranscriptEvent.Transcript.Results[0].Alternatives;
          if (alternatives.length > 0) {
            const transcriptText = alternatives[0].Transcript;
            resolve(transcriptText);
          }
        }
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Function to monitor a directory for new files and start transcription
async function watchDirectory(directoryPath, client, transcript) {
  const files = readdirSync(directoryPath);

  for (const file of files) {
    if (file.endsWith(".flac")) {
      const filePath = join(directoryPath, file);
      transcript = transcript + (await startTranscriptionForFile(filePath, client));
      logUpdate(transcript);
    }
  }

  // Watch for new files
  watch(directoryPath, async (eventType, fileName) => {
    console.log("added", eventType);
    if (eventType === "rename" && fileName && fileName.endsWith(".flac")) {
      const filePath = join(directoryPath, fileName);
      transcript = transcript + (await startTranscriptionForFile(filePath, client));
      logUpdate(transcript);
    }
  });
}

// Main function to start watching the directory and transcribing files
async function startTranscriptionForDirectory(directoryPath, transcript) {
  const client = new TranscribeStreamingClient({ region: "us-east-1" });
  await watchDirectory(directoryPath, client, transcript);
}

// Call the main function to start watching the directory and transcribing files
const directoryPath =
  "/Users/durgesh.rathod/Documents/client-data/ai-ml/sourcefuse/realtime-aws-transcribe/audio-source";
startTranscriptionForDirectory(directoryPath, transcript);
