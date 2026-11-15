from eventmanager import Evt
import os

class TopLapsMarshal:
    def __init__(self, rhapi):
        self._rhapi = rhapi
        
    def init_plugin(self):
        # register_option не поддерживается в 4.5.1 — опции читаем из БД с дефолтами
        self._rhapi.events.on(Evt.STARTUP, self.on_startup)
        
    def on_startup(self, args):
        try:
            import __main__
            app = __main__.APP
            
            @app.route('/top_laps_marshal/metadata')
            def top_laps_metadata():
                from flask import jsonify
                try:
                    format_data = {}
                    class_data = {}
                    errors = []
                    
                    formats = None
                    try:
                        formats = self._rhapi.db.raceformat_all()
                    except Exception as e:
                        errors.append("raceformat_all: " + str(e))
                        try:
                            formats = self._rhapi.db.raceformats
                        except Exception as e2:
                            errors.append("raceformats: " + str(e2))
                    
                    if formats:
                        for fmt in formats:
                            try:
                                sb = getattr(fmt, 'start_behavior', None)
                                if sb is not None:
                                    format_data[fmt.id] = sb
                            except Exception as e:
                                errors.append(f"format {getattr(fmt, 'id', '?')}: {e}")
                    
                    classes = None
                    try:
                        classes = self._rhapi.db.raceclass_all()
                    except Exception as e:
                        errors.append("raceclass_all: " + str(e))
                        try:
                            classes = self._rhapi.db.raceclasses
                        except Exception as e2:
                            errors.append("raceclasses: " + str(e2))
                    
                    if classes:
                        for cls in classes:
                            try:
                                class_data[cls.id] = cls.name
                            except Exception as e:
                                errors.append(f"class {getattr(cls, 'id', '?')}: {e}")
                    
                    # Читаем опции с дефолтными значениями
                    options = {
                        "skip_laps": 0,
                        "skip_rounds": 0,
                        "suspicious_iqr": 1.5,
                        "suspicious_pct": 25.0,
                        "window_size": 10
                    }
                    try:
                        val = self._rhapi.db.option("top_laps_marshal_skip_laps")
                        if val is not None:
                            options["skip_laps"] = int(val)
                    except Exception:
                        pass
                    try:
                        val = self._rhapi.db.option("top_laps_marshal_skip_rounds")
                        if val is not None:
                            options["skip_rounds"] = int(val)
                    except Exception:
                        pass
                    try:
                        val = self._rhapi.db.option("top_laps_marshal_suspicious_iqr")
                        if val is not None:
                            options["suspicious_iqr"] = float(val)
                    except Exception:
                        pass
                    try:
                        val = self._rhapi.db.option("top_laps_marshal_suspicious_pct")
                        if val is not None:
                            options["suspicious_pct"] = float(val)
                    except Exception:
                        pass
                    try:
                        val = self._rhapi.db.option("top_laps_marshal_window_size")
                        if val is not None:
                            options["window_size"] = max(2, int(val))
                    except Exception:
                        pass
                    
                    result = {
                        "formats": format_data,
                        "classes": class_data,
                        "options": options
                    }
                    if errors:
                        result["warnings"] = errors
                    
                    return jsonify(result)
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    return jsonify({"formats": {}, "classes": {}, "options": {}, "error": str(e)}), 500
            
            original_view = app.view_functions.get('render_marshal')
            if original_view:
                plugin_dir = os.path.dirname(os.path.abspath(__file__))
                js_path = os.path.join(plugin_dir, 'static', 'marshal.js')
                
                with open(js_path, 'r', encoding='utf-8') as f:
                    js_code = f.read()
                
                script = '<script>' + js_code + '</script>'
                
                def marshal_with_top_laps():
                    response = original_view()
                    if hasattr(response, 'data'):
                        content = response.data.decode('utf-8')
                        if '</body>' in content:
                            content = content.replace('</body>', script + '</body>')
                            response.data = content.encode('utf-8')
                    return response
                
                app.view_functions['render_marshal'] = marshal_with_top_laps
                print("TopLapsMarshal: routes registered (options read from db with fallback)")
                
        except Exception as e:
            print(f"TopLapsMarshal: startup error: {e}")
            import traceback
            traceback.print_exc()
    
    def cleanup_plugin(self):
        pass

def initialize(rhapi):
    plugin = TopLapsMarshal(rhapi)
    plugin.init_plugin()

def cleanup(rhapi):
    pass