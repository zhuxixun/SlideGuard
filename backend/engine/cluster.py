"""Page clustering and anomaly detection using scikit-learn."""

from typing import List, Tuple
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_distances

from backend.parsers import PptxData, SlideData
from backend.utils.color import hex_to_rgb


class PageCluster:
    """Cluster similar pages and detect anomalous ones."""

    def __init__(self, eps: float = 0.5, min_samples: int = 2):
        self.eps = eps
        self.min_samples = min_samples
        self.feature_names = [
            "element_count", "text_char_count", "image_count",
            "unique_fonts", "unique_colors", "coverage_ratio",
            "title_left", "title_top", "avg_font_size",
        ]

    def extract_features(self, slide: SlideData, pptx_data: PptxData) -> np.ndarray:
        """Extract feature vector from a slide for clustering."""
        page_area = pptx_data.slide_width * pptx_data.slide_height

        element_count = len(slide.shapes) + len(slide.images)
        text_char_count = sum(len(t.text) for s in slide.shapes
                              if s.has_text for t in s.text_elements)
        image_count = len(slide.images)

        fonts = set()
        colors = set()
        avg_font_sizes = []
        coverage = 0

        for shape in slide.shapes:
            if shape.has_text:
                for t in shape.text_elements:
                    if t.font_name:
                        fonts.add(t.font_name)
                    if t.font_color:
                        colors.add(t.font_color)
                    if t.font_size:
                        avg_font_sizes.append(t.font_size)
                coverage += shape.width * shape.height

        for img in slide.images:
            coverage += img.width * img.height

        coverage_ratio = coverage / page_area if page_area > 0 else 0

        # Find title position (first large text near top)
        title_left = 0
        title_top = 0
        for shape in slide.shapes:
            if shape.has_text:
                for t in shape.text_elements:
                    if t.is_title:
                        title_left = shape.left
                        title_top = shape.top
                        break
                if title_top > 0:
                    break

        avg_font = np.mean(avg_font_sizes) if avg_font_sizes else 0

        features = np.array([
            float(element_count),
            float(text_char_count),
            float(image_count),
            float(len(fonts)),
            float(len(colors)),
            float(coverage_ratio),
            float(title_left),
            float(title_top),
            float(avg_font),
        ])

        return features

    def analyze(self, pptx_data: PptxData) -> dict:
        """Cluster pages and identify anomalies.

        Returns:
            dict with per-slide cluster_id and anomaly_score
        """
        n_slides = len(pptx_data.slides)
        if n_slides < 3:
            # Not enough slides for meaningful clustering
            result = {}
            for slide in pptx_data.slides:
                result[slide.slide_index] = {
                    'cluster_id': 0,
                    'anomaly_score': 0.0,
                }
            return result

        # Extract features
        feature_list = []
        for slide in pptx_data.slides:
            feat = self.extract_features(slide, pptx_data)
            feature_list.append(feat)

        X = np.array(feature_list)

        # Normalize
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Cluster with DBSCAN
        clustering = DBSCAN(eps=self.eps, min_samples=min(self.min_samples, n_slides // 2))
        labels = clustering.fit_predict(X_scaled)

        # Calculate anomaly scores (distance to cluster centroid)
        centroids = {}
        for i, label in enumerate(labels):
            if label == -1:
                continue
            if label not in centroids:
                centroids[label] = []
            centroids[label].append(X_scaled[i])

        result = {}
        for i, (slide, label) in enumerate(zip(pptx_data.slides, labels)):
            anomaly_score = 0.0

            if label == -1:
                # Noise point = highly anomalous
                # Find distance to nearest cluster
                min_dist = float('inf')
                for cid, cpoints in centroids.items():
                    centroid = np.mean(cpoints, axis=0)
                    dist = np.linalg.norm(X_scaled[i] - centroid)
                    min_dist = min(min_dist, dist)
                anomaly_score = float(min_dist)
                # Cap infinity for valid JSON serialization
                if anomaly_score == float('inf'):
                    anomaly_score = 999.0
            elif label in centroids:
                centroid = np.mean(centroids[label], axis=0)
                dist = np.linalg.norm(X_scaled[i] - centroid)
                anomaly_score = float(dist)

            result[slide.slide_index] = {
                'cluster_id': int(label),
                'anomaly_score': float(anomaly_score),
                'features': X[i].tolist(),
            }

        return result


def analyze_page_anomalies(pptx_data: PptxData) -> dict:
    """Convenience function to run full cluster analysis."""
    cluster = PageCluster()
    return cluster.analyze(pptx_data)
