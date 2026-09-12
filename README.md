<img width="1280" height="640" alt="git (1)" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />



# Amma Radar


## Basic Details
### Team Name: Kriya


### Team Members
- Team Lead : Krishnapriya Rajeev - Toch Institute Of Science And Technology
- Member 2 : Diya Pillai -  Toch Institute Of Science And Technology

### Project Description
Amma Radar is a fun desktop AI companion that helps you know when someone is calling your name while you are busy on your laptop. It listens through the microphone, detects your name being called in Malayalam, and checks how many times you have been called and how loud the call was. Based on this, it shows an Amma Intensity level in real time.

### The Problem (that doesn't exist)
We all know that one situation where you are busy on your laptop and Amma calls you from another room. You ignore it once, maybe twice, and suddenly the third call sounds very serious. Then comes the classic question: "Didn't you hear me calling?"

### The Solution (that nobody asked for)
That's exactly why we made Amma Radar. It listens for your name, keeps track of repeated calls and loudness, and gives you a fun warning before the situation gets worse. Basically, it helps you know when "just one call" has turned into an Amma Emergency.

## Technical Details
### Technologies/Components Used
For Software:
- Languages: JavaScript, Python
- Frameworks: React, Electron
- Libraries: Faster-Whisper, SoundDevice
- Tools: Vite, Git, GitHub, Kiro IDE

For Hardware:
- Laptop/PC
- Built-in, wired, Bluetooth, or USB microphone
- No extra hardware required

### Implementation
For Software:
* The app runs as a small floating desktop companion using Electron and React.
* Python handles the microphone input and speech recognition.
* Faster-Whisper is used to understand Malayalam, Manglish, and mixed speech.
* The app looks for the user's name and checks things like how loud, how often, and how urgently it is being called.
* These are combined into an Amma Intensity Score™ from 0–100.
* As the score increases, the character reacts accordingly — from “Was that Amma?” to “RUN.”

# Installation
 # 1. Clone the repo
git clone https://github.com/krishnapriyaaahh/useless_project_2026.git
cd useless_project_2026/veetile-vicharana

 # 2. Install Python dependencies
cd ai
pip install -r requirements.txt

 # 3. Install Node dependencies
cd ../desktop
npm install

# Run
cd veetile-vicharana/desktop
npm install
npm run dev
cd veetile-vicharana/ai
pip install -r requirements.txt

### Project Documentation
For Software:
# Amma Radar — Veetile Vicharana

Amma Radar is a small desktop companion built for one simple problem: *knowing when Amma is actually calling you.*

It listens through your microphone, detects your name in Malayalam, Manglish, or mixed speech, and increases the intensity every time you ignore another call.

### Built With

* Electron
* React + Vite
* Python + Faster-Whisper
* SoundDevice

### How It Works

1. The microphone picks up speech and Whisper converts it to text locally.
2. The app checks if your name was called and looks for urgency in what was said.
3. Repeated calls, urgency, and how quickly the calls happen increase the intensity.
4. The little character reacts as things get worse.
5. At maximum intensity, the whole widget starts shaking because you probably should've gone the first time.

You can set your name, aliases, urgency phrases, and detection settings from the app itself.

*Because “I didn't hear you” doesn't work anymore.*

# Screenshots (Add at least 3)
Screenshot 2026-09-12 100901.png

Screenshot 2026-09-12 100952.png

### Project Demo
# Video
Screen Recording 2026-09-12 101524.mp4


## Team Contributions
- Krishnapriya Rajeev : Worked on the project idea, UI design, React and Electron development, and putting the different parts of the project together.
- Diya Pillai         : Worked on the Python backend, microphone and audio processing, speech recognition, name and urgency detection, testing, and fixing errors.

---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)



