"""HTML report generation."""

from typing import List
from jinja2 import Template
from backend.models.issue import Issue, ScanResult

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>质检报告 - {{ result.file_name }}</title>
<style>
body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 40px; color: #333; }
h1 { color: #1F4E79; border-bottom: 2px solid #2E75B6; padding-bottom: 10px; }
.score-card { background: #f5f8fc; border-radius: 8px; padding: 20px; margin: 20px 0; }
.score { font-size: 48px; font-weight: bold; color: {{ '#28a745' if result.score >= 80 else '#ffc107' if result.score >= 60 else '#dc3545' }}; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 20px 0; }
.grid-item { background: #fff; border-radius: 6px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.label { font-size: 12px; color: #666; }
.value { font-size: 18px; font-weight: bold; color: #1F4E79; }
.issue-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
.issue-table th { background: #1F4E79; color: #fff; padding: 10px; text-align: left; }
.issue-table td { padding: 10px; border-bottom: 1px solid #eee; }
.severity-S1 { background: #f8d7da; }
.severity-S2 { background: #fff3cd; }
.severity-S3 { background: #d1ecf1; }
.severity-S4 { background: #e2e3e5; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.badge-S1 { background: #dc3545; color: #fff; }
.badge-S2 { background: #ffc107; color: #333; }
.badge-S3 { background: #17a2b8; color: #fff; }
.badge-S4 { background: #6c757d; color: #fff; }
.dimension-bar { height: 20px; background: #e9ecef; border-radius: 10px; margin: 5px 0; overflow: hidden; }
.dimension-fill { height: 100%; background: #2E75B6; border-radius: 10px; transition: width 0.5s; }
</style>
</head>
<body>
<h1>SlideGuard 质检报告</h1>
<p>文件：{{ result.file_name }} | 页数：{{ result.total_pages }} | 扫描时间：{{ "%.1f"|format(result.scan_time_ms / 1000) }}秒</p>

<div class="score-card">
    <div class="label">总体评分</div>
    <div class="score">{{ result.score }}</div>
    <div style="margin-top:10px">
        已发现 <strong>{{ result.total_issues }}</strong> 个问题
        （S1: {{ result.s1_count }}, S2: {{ result.s2_count }},
         S3: {{ result.s3_count }}, S4: {{ result.s4_count }}）
    </div>
</div>

{% if result.dimension_scores %}
<h2>各维度得分</h2>
<div class="grid">
    {% for dim, score in result.dimension_scores.items() %}
    <div class="grid-item">
        <div class="label">{{ dim_labels.get(dim, dim) }}</div>
        <div class="value">{{ score }}</div>
        <div class="dimension-bar">
            <div class="dimension-fill" style="width: {{ score }}%"></div>
        </div>
    </div>
    {% endfor %}
</div>
{% endif %}

{% if result.all_issues %}
<h2>问题列表</h2>
<table class="issue-table">
<tr>
    <th>#</th><th>页面</th><th>类型</th><th>严重程度</th><th>问题描述</th><th>建议</th>
</tr>
{% for issue in result.all_issues %}
<tr class="severity-{{ issue.severity }}">
    <td>{{ loop.index }}</td>
    <td>第{{ issue.location.slide_index + 1 }}页</td>
    <td>{{ issue.rule_name }}</td>
    <td><span class="badge badge-{{ issue.severity }}">{{ issue.severity }}</span></td>
    <td>{{ issue.description }}</td>
    <td>{{ issue.suggestion }}</td>
</tr>
{% endfor %}
</table>
{% endif %}

<h2>各页面问题统计</h2>
<table class="issue-table">
<tr><th>页面</th><th>评分</th><th>S1</th><th>S2</th><th>S3</th><th>S4</th><th>可修复</th></tr>
{% for slide in result.slides %}
<tr>
    <td>第{{ slide.slide_index + 1 }}页</td>
    <td>{{ slide.score }}</td>
    <td>{{ slide.s1_count }}</td><td>{{ slide.s2_count }}</td>
    <td>{{ slide.s3_count }}</td><td>{{ slide.s4_count }}</td>
    <td>{{ slide.fixable_count }}</td>
</tr>
{% endfor %}
</table>

<p style="color: #666; margin-top: 40px; font-size: 12px;">
    SlideGuard 离线质检工具 | 生成时间：{{ scan_time }}
</p>
</body>
</html>"""


def generate_html_report(result: ScanResult, output_path: str):
    """Generate HTML report file."""
    dim_labels = {
        "document_integrity": "文档完整性与交付风险",
        "text_standardization": "文本规范性",
        "layout_quality": "版面布局质量",
        "cross_page_consistency": "跨页面一致性",
        "image_chart_quality": "图片与图表质量",
    }

    from datetime import datetime
    scan_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    template = Template(HTML_TEMPLATE)
    html = template.render(
        result=result,
        dim_labels=dim_labels,
        scan_time=scan_time,
    )

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    return output_path
