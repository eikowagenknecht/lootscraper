from importlib import metadata

__version__ = metadata.version(__package__)

del metadata  # Avoid polluting the results of dir(__package__)
