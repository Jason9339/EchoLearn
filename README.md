This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Voice Conversion Backend

This project includes a voice conversion backend powered by [FreeVC](https://github.com/OlaWod/FreeVC).

### Prerequisites

*   Python 3.11
*   `uv` for package management

### Installation

1.  **Navigate to the worker directory:**
    ```bash
    cd worker
    ```

2.  **Create a virtual environment:**
    ```bash
    uv venv
    ```

3.  **Activate the virtual environment:**
    ```bash
    source .venv/bin/activate
    ```

4.  **Install dependencies:**
    ```bash
    uv pip install -r src/FreeVC/requirements.txt
    ```

5.  **Download pre-trained models:**
    *   Download `freevc.pth` from [here](https://1drv.ms/u/s!AnvukVnlQ3ZTx1rjrOZ2abCwuBAh?e=UlhRR5) and place it in `worker/src/FreeVC/checkpoints/`.
    *   Download `WavLM-Large.pt` from the [WavLM repository](https://github.com/microsoft/unilm/tree/master/wavlm) and place it in `worker/src/FreeVC/wavlm/`.
    *   The `pretrained_bak_5805000.pt` speaker encoder model should already be present in `worker/src/FreeVC/speaker_encoder/ckpt/`.

### Execution

1.  **Start the Flask server:**
    ```bash
    cd worker
    source .venv/bin/activate
    python src/app.py
    ```
    The server will be running at `http://localhost:5001`.

### API Usage

#### Voice Conversion

*   **Endpoint:** `/worker/voice-conversion/convert`
*   **Method:** `POST`
*   **Body:** `multipart/form-data`
    *   `source_audio`: The source audio file (e.g., `.wav`).
    *   `target_audio`: The target audio file (e.g., `.wav`).

*   **Example `curl` command:**
    ```bash
    curl -X POST -F "source_audio=@/path/to/your/source.wav" -F "target_audio=@/path/to/your/target.wav" http://localhost:5001/worker/voice-conversion/convert -o converted_audio.wav
    ```

*   **Expected Outcome:**
    The API will return a `.wav` file with the voice from the `target_audio` applied to the content of the `source_audio`.