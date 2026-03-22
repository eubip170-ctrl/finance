"""
Graph API routes.
Uses a project context model with server-side persistent state.
"""

import os
import traceback
import threading
from flask import request, jsonify, g

from . import graph_bp
from ..config import Config
from ..i18n import msg
from ..services.ontology_generator import OntologyGenerator
from ..services.graph_builder import GraphBuilderService
from ..services.text_processor import TextProcessor
from ..utils.file_parser import FileParser
from ..utils.logger import get_logger
from ..models.task import TaskManager, TaskStatus
from ..models.project import ProjectManager, ProjectStatus

logger = get_logger('mirofish.api')


def allowed_file(filename: str) -> bool:
    """Return True if the file extension is in the allowed set."""
    if not filename or '.' not in filename:
        return False
    ext = os.path.splitext(filename)[1].lower().lstrip('.')
    return ext in Config.ALLOWED_EXTENSIONS


# ============== Project management ==============

@graph_bp.route('/project/<project_id>', methods=['GET'])
def get_project(project_id: str):
    """Return project details."""
    project = ProjectManager.get_project(project_id)

    if not project:
        return jsonify({
            "success": False,
            "error": msg('project_not_found', project_id=project_id)
        }), 404

    return jsonify({
        "success": True,
        "data": project.to_dict()
    })


@graph_bp.route('/project/list', methods=['GET'])
def list_projects():
    """Return a list of all projects."""
    limit = request.args.get('limit', 50, type=int)
    projects = ProjectManager.list_projects(limit=limit)
    
    return jsonify({
        "success": True,
        "data": [p.to_dict() for p in projects],
        "count": len(projects)
    })


@graph_bp.route('/project/<project_id>', methods=['DELETE'])
def delete_project(project_id: str):
    """Delete a project."""
    success = ProjectManager.delete_project(project_id)

    if not success:
        return jsonify({
            "success": False,
            "error": msg('project_not_found_deletion', project_id=project_id)
        }), 404

    return jsonify({
        "success": True,
        "message": msg('project_deleted', project_id=project_id)
    })


@graph_bp.route('/project/<project_id>/reset', methods=['POST'])
def reset_project(project_id: str):
    """Reset project state so the graph can be rebuilt."""
    project = ProjectManager.get_project(project_id)

    if not project:
        return jsonify({
            "success": False,
            "error": msg('project_not_found', project_id=project_id)
        }), 404

    # Reset to ontology-generated state if ontology exists
    if project.ontology:
        project.status = ProjectStatus.ONTOLOGY_GENERATED
    else:
        project.status = ProjectStatus.CREATED
    
    project.graph_id = None
    project.graph_build_task_id = None
    project.error = None
    ProjectManager.save_project(project)
    
    return jsonify({
        "success": True,
        "message": msg('project_reset', project_id=project_id),
        "data": project.to_dict()
    })


# ============== Endpoint 1: Upload files and generate ontology ==============

@graph_bp.route('/ontology/generate', methods=['POST'])
def generate_ontology():
    """
    Endpoint 1: Upload documents and generate an ontology definition.

    Request: multipart/form-data

    Fields:
        files: One or more uploaded files (PDF/MD/TXT).
        simulation_requirement: Required. Description of the simulation goal.
        project_name: Optional. Human-readable project name.
        additional_context: Optional. Extra background information.

    Returns:
        {
            "success": true,
            "data": {
                "project_id": "proj_xxxx",
                "ontology": {
                    "entity_types": [...],
                    "edge_types": [...],
                    "analysis_summary": "..."
                },
                "files": [...],
                "total_text_length": 12345
            }
        }
    """
    try:
        logger.info("=== Starting ontology generation ===")

        simulation_requirement = request.form.get('simulation_requirement', '')
        project_name = request.form.get('project_name', 'Unnamed Project')
        additional_context = request.form.get('additional_context', '')

        logger.debug(f"Project name: {project_name}")
        logger.debug(f"Simulation requirement: {simulation_requirement[:100]}...")

        if not simulation_requirement:
            return jsonify({
                "success": False,
                "error": msg('missing_simulation_requirement')
            }), 400

        uploaded_files = request.files.getlist('files')
        if not uploaded_files or all(not f.filename for f in uploaded_files):
            return jsonify({
                "success": False,
                "error": msg('no_files_uploaded')
            }), 400

        project = ProjectManager.create_project(name=project_name)
        project.simulation_requirement = simulation_requirement
        logger.info(f"Created project: {project.project_id}")

        document_texts = []
        all_text = ""

        for file in uploaded_files:
            if file and file.filename and allowed_file(file.filename):
                file_info = ProjectManager.save_file_to_project(
                    project.project_id, 
                    file, 
                    file.filename
                )
                project.files.append({
                    "filename": file_info["original_filename"],
                    "size": file_info["size"]
                })

                text = FileParser.extract_text(file_info["path"])
                text = TextProcessor.preprocess_text(text)
                document_texts.append(text)
                all_text += f"\n\n=== {file_info['original_filename']} ===\n{text}"
        
        if not document_texts:
            ProjectManager.delete_project(project.project_id)
            return jsonify({
                "success": False,
                "error": msg('no_documents_processed')
            }), 400

        project.total_text_length = len(all_text)
        ProjectManager.save_extracted_text(project.project_id, all_text)
        logger.info(f"Text extraction complete: {len(all_text)} characters")

        logger.info("Calling LLM to generate ontology...")
        locale = getattr(g, 'locale', 'en')
        generator = OntologyGenerator()
        ontology = generator.generate(
            document_texts=document_texts,
            simulation_requirement=simulation_requirement,
            additional_context=additional_context if additional_context else None,
            locale=locale
        )
        
        entity_count = len(ontology.get("entity_types", []))
        edge_count = len(ontology.get("edge_types", []))
        logger.info(f"Ontology generated: {entity_count} entity types, {edge_count} edge types")
        
        project.ontology = {
            "entity_types": ontology.get("entity_types", []),
            "edge_types": ontology.get("edge_types", [])
        }
        project.analysis_summary = ontology.get("analysis_summary", "")
        project.status = ProjectStatus.ONTOLOGY_GENERATED
        ProjectManager.save_project(project)
        logger.info(f"=== Ontology generation complete === project_id: {project.project_id}")
        
        return jsonify({
            "success": True,
            "data": {
                "project_id": project.project_id,
                "project_name": project.name,
                "ontology": project.ontology,
                "analysis_summary": project.analysis_summary,
                "files": project.files,
                "total_text_length": project.total_text_length
            }
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


# ============== Endpoint 2: Build graph ==============

@graph_bp.route('/build', methods=['POST'])
def build_graph():
    """
    Endpoint 2: Build a knowledge graph for a given project.

    Request (JSON):
        {
            "project_id": "proj_xxxx",  // required — from endpoint 1
            "graph_name": "My Graph",   // optional
            "chunk_size": 500,          // optional, default 500
            "chunk_overlap": 50         // optional, default 50
        }

    Returns:
        {
            "success": true,
            "data": {
                "project_id": "proj_xxxx",
                "task_id": "task_xxxx",
                "message": "Graph build task started"
            }
        }
    """
    try:
        logger.info("=== Starting graph build ===")

        errors = []
        if not Config.ZEP_API_KEY:
            errors.append(msg('zep_api_key_not_configured'))
        if errors:
            logger.error(f"Configuration errors: {errors}")
            return jsonify({
                "success": False,
                "error": "Configuration error: " + "; ".join(errors)
            }), 500

        data = request.get_json() or {}
        project_id = data.get('project_id')
        logger.debug(f"Request params: project_id={project_id}")

        if not project_id:
            return jsonify({
                "success": False,
                "error": msg('missing_project_id')
            }), 400

        project = ProjectManager.get_project(project_id)
        if not project:
            return jsonify({
                "success": False,
                "error": msg('project_not_found', project_id=project_id)
            }), 404

        force = data.get('force', False)

        if project.status == ProjectStatus.CREATED:
            return jsonify({
                "success": False,
                "error": msg('ontology_not_generated_yet')
            }), 400

        if project.status == ProjectStatus.GRAPH_BUILDING and not force:
            return jsonify({
                "success": False,
                "error": msg('graph_build_already_in_progress'),
                "task_id": project.graph_build_task_id
            }), 400

        if force and project.status in [ProjectStatus.GRAPH_BUILDING, ProjectStatus.FAILED, ProjectStatus.GRAPH_COMPLETED]:
            project.status = ProjectStatus.ONTOLOGY_GENERATED
            project.graph_id = None
            project.graph_build_task_id = None
            project.error = None
        
        graph_name = data.get('graph_name', project.name or 'MiroFish Graph')
        chunk_size = data.get('chunk_size', project.chunk_size or Config.DEFAULT_CHUNK_SIZE)
        chunk_overlap = data.get('chunk_overlap', project.chunk_overlap or Config.DEFAULT_CHUNK_OVERLAP)

        project.chunk_size = chunk_size
        project.chunk_overlap = chunk_overlap

        text = ProjectManager.get_extracted_text(project_id)
        if not text:
            return jsonify({
                "success": False,
                "error": msg('no_extracted_text')
            }), 400

        ontology = project.ontology
        if not ontology:
            return jsonify({
                "success": False,
                "error": msg('no_ontology_definition')
            }), 400

        task_manager = TaskManager()
        task_id = task_manager.create_task(f"Build graph: {graph_name}")
        logger.info(f"Created graph build task: task_id={task_id}, project_id={project_id}")

        project.status = ProjectStatus.GRAPH_BUILDING
        project.graph_build_task_id = task_id
        ProjectManager.save_project(project)

        def build_task():
            build_logger = get_logger('mirofish.build')
            try:
                build_logger.info(f"[{task_id}] Starting graph build...")
                task_manager.update_task(
                    task_id,
                    status=TaskStatus.PROCESSING,
                    message=msg('graph_build_initializing')
                )

                builder = GraphBuilderService(api_key=Config.ZEP_API_KEY)

                task_manager.update_task(
                    task_id,
                    message=msg('graph_build_splitting_text'),
                    progress=5
                )
                chunks = TextProcessor.split_text(
                    text, 
                    chunk_size=chunk_size, 
                    overlap=chunk_overlap
                )
                total_chunks = len(chunks)

                task_manager.update_task(
                    task_id,
                    message=msg('graph_build_creating_graph'),
                    progress=10
                )
                graph_id = builder.create_graph(name=graph_name)

                project.graph_id = graph_id
                ProjectManager.save_project(project)

                task_manager.update_task(
                    task_id,
                    message=msg('graph_build_applying_ontology'),
                    progress=15
                )
                builder.set_ontology(graph_id, ontology)

                # progress_callback signature: (msg, progress_ratio)
                def add_progress_callback(msg, progress_ratio):
                    progress = 15 + int(progress_ratio * 40)  # 15% - 55%
                    task_manager.update_task(
                        task_id,
                        message=msg,
                        progress=progress
                    )

                task_manager.update_task(
                    task_id,
                    message=msg('graph_build_adding_chunks', total_chunks=total_chunks),
                    progress=15
                )
                
                episode_uuids = builder.add_text_batches(
                    graph_id, 
                    chunks,
                    batch_size=3,
                    progress_callback=add_progress_callback
                )
                
                # Wait for Zep to process all episodes
                task_manager.update_task(
                    task_id,
                    message=msg('graph_build_waiting_zep'),
                    progress=55
                )

                def wait_progress_callback(msg, progress_ratio):
                    progress = 55 + int(progress_ratio * 35)  # 55% - 90%
                    task_manager.update_task(
                        task_id,
                        message=msg,
                        progress=progress
                    )

                builder._wait_for_episodes(episode_uuids, wait_progress_callback)

                task_manager.update_task(
                    task_id,
                    message=msg('graph_build_retrieving_data'),
                    progress=95
                )
                graph_data = builder.get_graph_data(graph_id)
                
                project.status = ProjectStatus.GRAPH_COMPLETED
                ProjectManager.save_project(project)

                node_count = graph_data.get("node_count", 0)
                edge_count = graph_data.get("edge_count", 0)
                build_logger.info(
                    f"[{task_id}] Graph build complete: graph_id={graph_id}, "
                    f"nodes={node_count}, edges={edge_count}"
                )

                task_manager.update_task(
                    task_id,
                    status=TaskStatus.COMPLETED,
                    message=msg('graph_build_complete'),
                    progress=100,
                    result={
                        "project_id": project_id,
                        "graph_id": graph_id,
                        "node_count": node_count,
                        "edge_count": edge_count,
                        "chunk_count": total_chunks
                    }
                )
                
            except Exception as e:
                build_logger.error(f"[{task_id}] Graph build failed: {str(e)}")
                build_logger.debug(traceback.format_exc())

                project.status = ProjectStatus.FAILED
                project.error = str(e)
                ProjectManager.save_project(project)

                task_manager.update_task(
                    task_id,
                    status=TaskStatus.FAILED,
                    message=msg('graph_build_failed', error=str(e)),
                    error=traceback.format_exc()
                )

        thread = threading.Thread(target=build_task, daemon=True)
        thread.start()
        
        return jsonify({
            "success": True,
            "data": {
                "project_id": project_id,
                "task_id": task_id,
                "message": msg('graph_build_task_started', task_id=task_id)
            }
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


# ============== Task query ==============

@graph_bp.route('/task/<task_id>', methods=['GET'])
def get_task(task_id: str):
    """Return the status of a background task."""
    task = TaskManager().get_task(task_id)

    if not task:
        return jsonify({
            "success": False,
            "error": msg('task_not_found', task_id=task_id)
        }), 404
    
    return jsonify({
        "success": True,
        "data": task.to_dict()
    })


@graph_bp.route('/tasks', methods=['GET'])
def list_tasks():
    """Return a list of all tasks."""
    tasks = TaskManager().list_tasks()
    
    return jsonify({
        "success": True,
        "data": [t.to_dict() for t in tasks],
        "count": len(tasks)
    })


# ============== Graph data ==============

@graph_bp.route('/data/<graph_id>', methods=['GET'])
def get_graph_data(graph_id: str):
    """Return graph data (nodes and edges)."""
    try:
        if not Config.ZEP_API_KEY:
            return jsonify({
                "success": False,
                "error": msg('zep_api_key_not_configured')
            }), 500

        builder = GraphBuilderService(api_key=Config.ZEP_API_KEY)
        graph_data = builder.get_graph_data(graph_id)
        
        return jsonify({
            "success": True,
            "data": graph_data
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


@graph_bp.route('/delete/<graph_id>', methods=['DELETE'])
def delete_graph(graph_id: str):
    """Delete a Zep graph."""
    try:
        if not Config.ZEP_API_KEY:
            return jsonify({
                "success": False,
                "error": msg('zep_api_key_not_configured')
            }), 500

        builder = GraphBuilderService(api_key=Config.ZEP_API_KEY)
        builder.delete_graph(graph_id)

        return jsonify({
            "success": True,
            "message": msg('graph_deleted', graph_id=graph_id)
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500
