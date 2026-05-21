import base64
import os

images = ["screenshots/stage1.png", "screenshots/stage2.png", "screenshots/stage3.png", "screenshots/stage4.png"]

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <style>
        .stage {
            animation: fade 12s infinite;
            opacity: 0;
        }
        .stage-1 { animation-delay: 0s; }
        .stage-2 { animation-delay: 3s; }
        .stage-3 { animation-delay: 6s; }
        .stage-4 { animation-delay: 9s; }
        
        @keyframes fade {
            0% { opacity: 1; }
            23% { opacity: 1; }
            25% { opacity: 0; }
            100% { opacity: 0; }
        }
    </style>
'''

for i, img_path in enumerate(images):
    if not os.path.exists(img_path): 
        print(f"Missing {img_path}")
        continue
    with open(img_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    svg_content += f'    <image href="data:image/png;base64,{data}" width="1280" height="720" class="stage stage-{i+1}" />\n'

svg_content += '</svg>'

with open("screenshots/demo_video.svg", "w") as f:
    f.write(svg_content)
print("Created screenshots/demo_video.svg successfully!")
