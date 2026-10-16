#!/usr/bin/env python3
"""Static file server with HTTP Range support (needed for video/audio).

Usage:  python3 serve.py [port]
Then open http://127.0.0.1:8000/  (or the port you pass).
Unlike python -m http.server, this answers 206 Partial Content so
Chrome/Safari can seek and stream the reel videos and song clips.
"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")

class RangeHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        fs = os.fstat(f.fileno())
        size = fs.st_size
        ctype = self.guess_type(path)
        range_header = self.headers.get("Range")
        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            return f
        m = RANGE_RE.match(range_header.strip())
        if not m:
            f.close()
            self.send_error(400, "Invalid Range")
            return None
        start_s, end_s = m.group(1), m.group(2)
        if start_s == "" and end_s == "":
            f.close()
            self.send_error(400, "Invalid Range")
            return None
        if start_s == "":
            # suffix range: last N bytes
            length = int(end_s)
            start = max(0, size - length)
            end = size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        length = end - start + 1
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        # wrap so copyfile only sends the slice
        return _Limited(f, length)

    def copyfile(self, source, outputfile):
        # support the limited wrapper from send_head
        limit = getattr(source, "remaining", None)
        if limit is None:
            return super().copyfile(source, outputfile)
        bufsize = 64 * 1024
        while limit > 0:
            chunk = source.read(min(bufsize, limit))
            if not chunk:
                break
            outputfile.write(chunk)
            limit -= len(chunk)

class _Limited:
    def __init__(self, fp, length):
        self._fp = fp
        self.remaining = length
    def read(self, n=-1):
        if self.remaining <= 0:
            return b""
        if n is None or n < 0:
            n = self.remaining
        chunk = self._fp.read(min(n, self.remaining))
        self.remaining -= len(chunk)
        return chunk
    def close(self):
        self._fp.close()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(RangeHandler, directory=os.path.dirname(os.path.abspath(__file__)))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Serving with Range support at http://127.0.0.1:{port}/  (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
