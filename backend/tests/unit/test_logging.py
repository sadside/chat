import logging

from app.core.logging import configure_logging, get_logger


def test_get_logger_returns_bound_logger():
    configure_logging(level="INFO", json_logs=False)
    logger = get_logger("test")
    assert logger is not None
    logger.info("hello", foo="bar")


def test_configure_logging_sets_level():
    configure_logging(level="DEBUG", json_logs=False)
    assert logging.getLogger().level == logging.DEBUG
