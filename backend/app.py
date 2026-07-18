"""SlideGuard Flask application - REST API backend."""

import os
import json
import tempfile
from flask import Flask, request, jsonify, send_file, send_from_directory

from backend.config import RuleConfig
from backend.engine.scanner import Scanner
from backend.engine.fixer import quick_fix
from backend.engine.cluster import analyze_page_anomalies
from backend.reporters.html_reporter import generate_html_report
from backend.reporters.excel_reporter import generate_excel_report
from backend.parsers import parse_pptx

app = Flask(__name__, static_folder='../frontend/static', template_folder='../frontend/templates')
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB

config = RuleConfig()
scanner = Scanner(config)

UPLOAD_DIR = os.path.join(tempfile.gettempdir(), 'slideguard')
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _issue_to_dict(issue):
    return {
        "rule_id": issue.rule_id,
        "rule_name": issue.rule_name,
        "severity": issue.severity,
        "description": issue.description,
        "detail": issue.detail,
        "suggestion": issue.suggestion,
        "location": {
            "slide_index": issue.location.slide_index,
            "element_id": issue.location.element_id,
            "element_name": issue.location.element_name,
            "element_type": issue.location.element_type,
            "left": issue.location.left,
            "top": issue.location.top,
            "width": issue.location.width,
            "height": issue.location.height,
        },
        "actual_value": issue.actual_value,
        "expected_value": issue.expected_value,
        "auto_fixable": issue.auto_fixable,
        "fix_type": issue.fix_type,
        "status": issue.status,
    }


def _slide_to_dict(slide_summary):
    return {
        "slide_index": slide_summary.slide_index,
        "score": slide_summary.score,
        "issue_count": slide_summary.total_issues,
        "s1_count": slide_summary.s1_count,
        "s2_count": slide_summary.s2_count,
        "s3_count": slide_summary.s3_count,
        "s4_count": slide_summary.s4_count,
        "fixable_count": slide_summary.fixable_count,
        "issues": [_issue_to_dict(i) for i in slide_summary.issues],
    }


def _result_to_dict(result):
    return {
        "file_name": result.file_name,
        "file_size": result.file_size,
        "total_pages": result.total_pages,
        "page_width": result.page_size[0],
        "page_height": result.page_size[1],
        "score": result.score,
        "dimension_scores": result.dimension_scores,
        "scan_time_ms": result.scan_time_ms,
        "total_issues": result.total_issues,
        "s1_count": result.s1_count,
        "s2_count": result.s2_count,
        "s3_count": result.s3_count,
        "s4_count": result.s4_count,
        "fixable_count": result.fixable_count,
        "slides": [_slide_to_dict(s) for s in result.slides],
        "rules_applied": result.rules_applied,
    }


# --- API Routes ---

@app.route('/api/scan', methods=['POST'])
def scan_pptx():
    """Upload and scan a PPTX file."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if not file.filename.endswith('.pptx'):
        return jsonify({"error": "Only .pptx files are supported"}), 400

    # Save uploaded file
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    file.save(file_path)

    mode = request.form.get('mode', 'standard')

    try:
        result = scanner.scan(file_path, mode=mode)

        # Run cluster analysis if standard mode
        cluster_data = None
        if mode == "standard" and result.total_pages >= 3:
            try:
                pptx_data = parse_pptx(file_path)
                cluster_data = analyze_page_anomalies(pptx_data)

                # Attach anomaly info to slides
                if cluster_data:
                    for slide in result.slides:
                        cd = cluster_data.get(slide.slide_index, {})
                        slide.cluster_id = cd.get('cluster_id', -1)
                        slide.anomaly_score = cd.get('anomaly_score', 0.0)
            except Exception:
                pass

        data = _result_to_dict(result)
        data['file_path'] = file_path

        if cluster_data:
            data['cluster'] = {
                str(k): {
                    'cluster_id': v['cluster_id'],
                    'anomaly_score': round(v['anomaly_score'], 4),
                }
                for k, v in cluster_data.items()
            }

        return jsonify(data)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Scan failed: {str(e)}"}), 500


@app.route('/api/rescan', methods=['POST'])
def rescan_pptx():
    """Re-scan a previously processed file by path."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    file_path = data.get('file_path')
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    try:
        result = scanner.scan(file_path)
        data = _result_to_dict(result)
        data['file_path'] = file_path
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": f"Rescan failed: {str(e)}"}), 500


@app.route('/api/fix', methods=['POST'])
def fix_pptx():
    """Apply auto-fixes to a previously scanned PPTX."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    file_path = data.get('file_path')
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    try:
        # Re-scan to get current issues
        result = scanner.scan(file_path)

        if result.fixable_count == 0:
            return jsonify({"message": "No fixable issues found"}), 200

        output_path = os.path.join(
            UPLOAD_DIR,
            f"fixed_{os.path.basename(file_path)}"
        )

        fixed_count, output_path = quick_fix(file_path, result.all_issues, output_path)

        # Re-scan to compare
        new_result = None
        if os.path.exists(output_path):
            new_result = scanner.scan(output_path)

        return jsonify({
            "fixed_count": fixed_count,
            "output_path": output_path,
            "output_name": os.path.basename(output_path),
            "before_score": result.score,
            "after_score": new_result.score if new_result else None,
            "before_issues": result.total_issues,
            "after_issues": new_result.total_issues if new_result else None,
        })

    except Exception as e:
        return jsonify({"error": f"Fix failed: {str(e)}"}), 500


@app.route('/api/report/<format>', methods=['POST'])
def generate_report(format: str):
    """Generate and download a report."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    file_path = data.get('file_path')
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    try:
        result = scanner.scan(file_path)

        if format == 'html':
            output = os.path.join(UPLOAD_DIR, f"report_{os.path.basename(file_path)}.html")
            generate_html_report(result, output)
            return send_file(output, mimetype='text/html',
                           as_attachment=True,
                           download_name=f"report_{os.path.basename(file_path)}.html")

        elif format == 'xlsx':
            output = os.path.join(UPLOAD_DIR, f"report_{os.path.basename(file_path)}.xlsx")
            generate_excel_report(result, output)
            return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                           as_attachment=True,
                           download_name=f"report_{os.path.basename(file_path)}.xlsx")

        return jsonify({"error": f"Unsupported format: {format}"}), 400

    except Exception as e:
        return jsonify({"error": f"Report generation failed: {str(e)}"}), 500


@app.route('/api/download', methods=['GET'])
def download_file():
    """Download a fixed PPTX file."""
    file_path = request.args.get('path')
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    return send_file(file_path, as_attachment=True,
                     download_name=os.path.basename(file_path))


@app.route('/api/info', methods=['GET'])
def get_info():
    """Get application info."""
    return jsonify({
        "name": "SlideGuard",
        "version": "MVP 1.0",
        "description": "离线PPT智能质检与规范化工具",
        "offline": True,
    })


@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current rule configuration."""
    return jsonify({
        "standard_fonts": list(config.standard_fonts),
        "min_body_font_size": config.min_body_font_size,
        "max_colors_per_page": config.max_colors_per_page,
        "page_aspect_ratio": config.page_aspect_ratio,
        "min_text_contrast_ratio": config.min_text_contrast_ratio,
        "alignment_tolerance": config.alignment_tolerance,
        "page_margin_min": config.page_margin_min,
    })


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def index(path):
    """Serve frontend."""
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.template_folder, 'index.html')


def main():
    """Run the Flask app."""
    import webbrowser
    port = 5000
    print(f"  SlideGuard 启动中...")
    print(f"  打开浏览器访问: http://127.0.0.1:{port}")
    print(f"  文件仅在本机处理，不会上传至任何服务器")
    webbrowser.open(f'http://127.0.0.1:{port}')
    app.run(host='127.0.0.1', port=port, debug=False)


if __name__ == '__main__':
    main()
