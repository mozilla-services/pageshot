import os
import re
import requests
from urlparse import urljoin
import json
import uuid
import random
import time

example_images = {}
execfile(os.path.normpath(os.path.join(__file__, "../../../bin/load_test_exercise_images.py")), example_images)
example_images = example_images["example_images"]


class ScreenshotsClient(object):

    def __init__(self, backend="http://localhost:10080"):
        self.backend = backend
        self.deviceInfo = make_device_info()
        self.deviceId = make_uuid()
        self.secret = make_uuid()
        self.session = requests.Session()

    def login(self):
        resp = self.session.post(
            urljoin(self.backend, "/api/login"),
            data=dict(deviceId=self.deviceId, secret=self.secret, deviceInfo=json.dumps(self.deviceInfo)))
        if resp.status_code == 404:
            resp = self.session.post(
                urljoin(self.backend, "/api/register"),
                data=dict(deviceId=self.deviceId, secret=self.secret, deviceInfo=json.dumps(self.deviceInfo)))
        resp.raise_for_status()

    def delete_account(self):
        resp = self.session.post(
            urljoin(self.backend, "/leave-screenshots/leave"),
            json={})
        resp.raise_for_status()

    def create_shot(self, shot_id=None, **example_args):
        if not shot_id:
            shot_id = make_random_id() + "/test.com"
        shot_url = urljoin(self.backend, shot_id)
        shot_data = urljoin(self.backend, "data/" + shot_id)
        shot_json = make_example_shot(self.deviceId, **example_args)
        resp = self.session.put(
            shot_data,
            json=shot_json,
        )
        resp.raise_for_status()
        print("status", resp.status_code)
        return shot_url

    def read_shot(self, url):
        # FIXME: should get at least the clip image subresource itself
        resp = self.session.get(url)
        resp.raise_for_status()
        page = resp.text
        clip_match = re.search(r'<img id="clipImage"[^>]*src="([^"]+)"', page)
        clip_url = clip_content = None
        if clip_match:
            clip_url = clip_match.group(1)
            clip_content = self.session.get(clip_url).content
        return {"page": page, "clip_url": clip_url, "clip_content": clip_content}

    def read_my_shots(self):
        resp = self.session.get(urljoin(self.backend, "/shots"))
        resp.raise_for_status()

    def search_shots(self, q):
        resp = self.session.get(urljoin(self.backend, "/shots"), params={"q": q})
        resp.raise_for_status()


def make_example_shot(deviceId, **overrides):
    image = random.choice(example_images)
    text = []
    for i in range(10):
        text.append(random.choice(text_strings))
    text = " ".join(text)
    return dict(
        deviceId=deviceId,
        url="http://test.com/?" + make_uuid(),
        docTitle=overrides.get("docTitle", "Load test page"),
        createdDate=int(time.time() * 1000),
        favicon=None,
        siteName="test site",
        clips={
            make_uuid(): dict(
                createdDate=int(time.time() * 1000),
                sortOrder=100,
                image=dict(
                    url=image["url"],
                    captureType="selection",
                    text=text,
                    location=dict(
                        top=100,
                        left=100,
                        bottom=100 + image["height"],
                        right=100 + image["width"],
                    ),
                    dimensions=dict(
                        x=image["width"],
                        y=image["height"],
                    ),
                ),
            ),
        },
    )


text_strings = """
Example strings like apple orange banana some stuff like whatever and whoever
and bucket blanket funky etc keyboard screen house window tree leaf leaves
feather feathers
""".split()


def make_device_info():
    return dict(
        addonVersion='0.1.2014test',
        platform='test',
    )


def make_uuid():
    return str(uuid.uuid1()).replace("-", "")


def make_random_id():
    return make_uuid()[:16]
