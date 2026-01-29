

import asyncio
import os
import json
import base64
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# --- Requirements ---
# pip install fastapi uvicorn browser-use python-dotenv

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BrowserRequest(BaseModel):
    task: str
    api_key: str

async def stream_browser_agent(task: str, api_key: str):
    """
    Runs the browser-use agent and yields JSON strings (NDJSON format).
    Each chunk is a complete JSON object followed by a newline.
    """
    try:
        # Import dependencies as requested
        try:
            from browser_use import Agent, Browser, ChatOpenAI
        except ImportError:
            # Fallback if ChatOpenAI is not exported by browser_use directly
            from browser_use import Agent, Browser
            from langchain_openai import ChatOpenAI

        load_dotenv()

        browser = Browser(
            headless=True,  # Show browser window
            window_size={'width': 1000, 'height': 700},  # Set window size
        )

        # All the models are type safe from OpenAI in case you need a list of supported models
        llm = ChatOpenAI(
            model='meta/llama-4-maverick-17b-128e-instruct',
            base_url='https://integrate.api.nvidia.com/v1',
            api_key=api_key,
        )

        agent = Agent(
            task=task,
            llm=llm,
            browser=browser,
            use_vision=True,
        )

        history = await agent.run()

        # Stream history steps
        if hasattr(history, 'history'):
            for step in history.history:
                thought = ""
                screenshot_b64 = None
                
                try:
                    if hasattr(step, 'model_output'):
                        thought = str(step.model_output)
                    
                    if hasattr(step, 'state') and hasattr(step.state, 'screenshot'):
                        screenshot_b64 = step.state.screenshot
                except Exception:
                    pass
                
                update = {
                    "type": "step",
                    "text": thought or "Processing step...",
                    "screenshot": screenshot_b64
                }
                yield json.dumps(update) + "\n"
                await asyncio.sleep(0.05)
        
        final_result = history.final_result() if hasattr(history, 'final_result') else str(history)
        
        yield json.dumps({
            "type": "result",
            "content": final_result
        }) + "\n"
        
        await browser.close()

    except Exception as e:
        yield json.dumps({
            "type": "error",
            "content": str(e)
        }) + "\n"

@app.post("/browser/start")
async def start_browser(request: BrowserRequest):
    return StreamingResponse(stream_browser_agent(request.task, request.api_key), media_type="application/x-ndjson")

if __name__ == "__main__":
    import uvicorn
    print("Starting Browser-Use Server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
