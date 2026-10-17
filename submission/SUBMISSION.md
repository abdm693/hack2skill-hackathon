# Naqsha · AI Builder Cup 2026 submission checklist

**Team:** Pivot Analytix. Abdullah Moazzam (team leader), Saad Wali Muhammad Joiya, Usama Bin Maalik.
**Track:** Theme 5, Future of Work & Enterprise Productivity.
**Industry:** architecture, engineering and construction (AEC) and residential real estate. Pakistan first, then worldwide.

| # | Required item | Status | Where |
|---|---|---|---|
| 1 | Pitch deck in the prescribed template, final as PDF | Done | [Naqsha_AI_Builder_Cup_Submission.pdf](Naqsha_AI_Builder_Cup_Submission.pdf) (PPTX source: [Naqsha_AI_Builder_Cup_Submission.pptx](Naqsha_AI_Builder_Cup_Submission.pptx)) |
| 2 | Demo video, 3–4 minutes | Done (3:57, 1080p) | https://drive.google.com/file/d/1xmdn7qxZRsblvwNLezveUji1tdc8WjBB/view?usp=sharing |
| 3 | Working deployed link | Live | https://naqsha-242926648187.us-central1.run.app |
| 4 | Accessible GitHub repository | Public | https://github.com/abdm693/hack2skill-hackathon |
| 5 | Brief description, covering Firebase, Firestore, Cloud Run and Gemini | Done | [description.md](description.md) |
| 6 | Track named, and the industry whose work we disrupt | Done | Deck slides 1, 2 and 15; description.md |
| 7 | How judges can test it | Done | Deck slide 14; [JUDGES.md](../JUDGES.md) with screenshots |

## Before pressing Submit
- [ ] Paste the 1,010-character form text (the code block at the top of [description.md](description.md)) into "Brief Description of Your Solution".
- [x] Video link opens without sign-in (Anyone with the link: Viewer), checked 17 Oct.
- [ ] Open the live app in a private window. "Try a sample" should load a home without an account.
- [ ] Sign up once on the live app with a real email to confirm accounts work. Automated agents may not create accounts on the external identity provider, so this has to be done by hand.
- [ ] Upload the deck PDF.

## Notes
- **Where the video lives:** it is hosted on Google Drive. The source MP4 stays local (`submission/Naqsha_Demo_Video.mp4`) because it exceeds GitHub's 100 MB file limit. The HyperFrames project sources are in `submission/video/hyperframes/`.
- **Narration:** Gemini 3.8 Flash TTS, persona voice `hi-in-csagent-11`, directed to a modern Pakistani-English delivery. The script is in `submission/video/hyperframes/scripts/vo_lines.json`.
- **Agentic harness:** Google ADK 2.12, with two agents and 14 tools. Gemini 4 Argon runs the architect pipeline. Everything is served from one Cloud Run service, with data in Firestore and Cloud Storage and sign-in through Firebase Authentication.
