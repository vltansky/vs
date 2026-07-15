import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "fetch_comments.py"


def load_script():
    spec = importlib.util.spec_from_file_location("fetch_comments", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {SCRIPT_PATH}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FetchCommentsTest(unittest.TestCase):
    def test_parses_base_repository_from_pr_url(self):
        script = load_script()

        self.assertEqual(
            script.parse_pr_url("https://github.com/upstream/project/pull/42"),
            ("upstream", "project", 42),
        )

    def test_paginates_each_connection_without_restarting_completed_pages(self):
        script = load_script()
        requested_cursors = []
        pages = {
            None: {
                "nodes": [{"id": "first"}],
                "pageInfo": {"hasNextPage": True, "endCursor": "next"},
            },
            "next": {
                "nodes": [{"id": "second"}],
                "pageInfo": {"hasNextPage": False, "endCursor": None},
            },
        }

        def fetch_page(cursor):
            requested_cursors.append(cursor)
            return pages[cursor]

        self.assertEqual(
            script.paginate(fetch_page),
            [{"id": "first"}, {"id": "second"}],
        )
        self.assertEqual(requested_cursors, [None, "next"])

    def test_rejects_a_next_page_without_a_cursor(self):
        script = load_script()

        with self.assertRaisesRegex(RuntimeError, "missing an end cursor"):
            script.paginate(
                lambda _cursor: {
                    "nodes": [],
                    "pageInfo": {"hasNextPage": True, "endCursor": None},
                },
            )


if __name__ == "__main__":
    unittest.main()
